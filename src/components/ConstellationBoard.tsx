import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type View as RNView,
} from 'react-native';

import {
  GAME_LEVELS,
  MAX_SUBMIT_TRIES,
  TOAST_DURATION_MS,
} from '@/constants/game';
import type {
  DragState,
  GamePhase,
  LayoutRect,
  WordCardModel,
  Zone,
} from '@/types/cards';
import { fetchGameWords, GameWordsApiError } from '@/utils/gameWordsApi';
import {
  type CachedCompletedLevelState,
  readCachedGameState,
  writeCachedGameState,
} from '@/utils/gameStateCache';
import {
  getPathInsertionIndex,
  pointInRect,
} from '@utils/dragGeometry';
import { mergeIntoFieldOrder, playOrderMatches } from '@utils/fieldOrder';

import { Button } from './Button';
import { GameBanner } from './GameBanner';
import { GameToast } from './GameToast';
import { CARD_HEIGHT, CARD_WIDTH } from './WordCard';
import { DraggableWordCard } from './DraggableWordCard';
import { PlayAreaCardSlot } from './PlayAreaCardSlot';

function measureViewInWindow(
  view: RNView | null,
  callback: (rect: LayoutRect) => void,
) {
  if (!view) {
    return;
  }
  view.measureInWindow((x, y, width, height) => {
    callback({ x, y, width, height });
  });
}

function getServiceErrorCode(error: unknown): string {
  return error instanceof GameWordsApiError ? error.code : 'UNKNOWN_ERROR';
}

function getServiceErrorMessage(error: unknown): string {
  if (error instanceof GameWordsApiError) {
    return `${error.message} (${error.code})`;
  }

  return error instanceof Error ? error.message : 'Unable to load words';
}

function showServiceOfflineAlert(error: unknown) {
  Alert.alert('Service offline', `Error code: ${getServiceErrorCode(error)}`);
}

function mergeLevelState(
  states: CachedCompletedLevelState[],
  state: CachedCompletedLevelState,
): CachedCompletedLevelState[] {
  return [
    ...states.filter((item) => item.levelIndex !== state.levelIndex),
    state,
  ].sort((a, b) => a.levelIndex - b.levelIndex);
}

const MIN_PLAY_CARD_WIDTH = 88;
const MAX_HORSESHOE_WIDTH = 560;
const PLAY_CARD_GAP = 10;
const DEBUG_DRAG = true;

function debugBoardDrag(message: string, details?: unknown) {
  if (!DEBUG_DRAG) {
    return;
  }

  console.log(`[drag-board] ${message}`, details ?? '');
}

interface HorseshoeSlot {
  left: number;
  top: number;
}

interface HorseshoeLayout {
  cardWidth: number;
  cardHeight: number;
  height: number;
  slots: HorseshoeSlot[];
}

interface PlayColumnSize {
  width: number;
  height: number;
}

function getHorseshoeTemplate(wordCount: number): Array<{ x: number; row: number }> {
  if (wordCount >= 9) {
    return [
      { x: -1, row: 0 },
      { x: -1.08, row: 1 },
      { x: -0.92, row: 2 },
      { x: -0.55, row: 3 },
      { x: 0, row: 4 },
      { x: 0.55, row: 3 },
      { x: 0.92, row: 2 },
      { x: 1.08, row: 1 },
      { x: 1, row: 0 },
    ];
  }

  if (wordCount >= 7) {
    return [
      { x: -1, row: 0 },
      { x: -1.04, row: 1 },
      { x: -0.78, row: 2 },
      { x: 0, row: 3 },
      { x: 0.78, row: 2 },
      { x: 1.04, row: 1 },
      { x: 1, row: 0 },
    ];
  }

  return [
    { x: -1, row: 0 },
    { x: -0.88, row: 1 },
    { x: 0, row: 2 },
    { x: 0.88, row: 1 },
    { x: 1, row: 0 },
  ];
}

function getHorseshoeBoundary(
  layout: HorseshoeLayout,
  index: number,
): { x: number; y: number } | null {
  const previous = layout.slots[index - 1];
  const next = layout.slots[index];

  const center = (slot: HorseshoeSlot) => ({
    x: slot.left + layout.cardWidth / 2,
    y: slot.top + layout.cardHeight / 2,
  });

  if (previous && next) {
    const previousCenter = center(previous);
    const nextCenter = center(next);
    return {
      x: (previousCenter.x + nextCenter.x) / 2,
      y: (previousCenter.y + nextCenter.y) / 2,
    };
  }

  if (next) {
    const nextCenter = center(next);
    const afterNext = layout.slots[index + 1];
    if (!afterNext) {
      return nextCenter;
    }

    const afterNextCenter = center(afterNext);
    return {
      x: nextCenter.x - (afterNextCenter.x - nextCenter.x) / 2,
      y: nextCenter.y - (afterNextCenter.y - nextCenter.y) / 2,
    };
  }

  if (previous) {
    const previousCenter = center(previous);
    const beforePrevious = layout.slots[index - 2];
    if (!beforePrevious) {
      return previousCenter;
    }

    const beforePreviousCenter = center(beforePrevious);
    return {
      x: previousCenter.x + (previousCenter.x - beforePreviousCenter.x) / 2,
      y: previousCenter.y + (previousCenter.y - beforePreviousCenter.y) / 2,
    };
  }

  return null;
}

function createHorseshoeLayout(
  size: PlayColumnSize,
  wordCount: number,
): HorseshoeLayout {
  const { height: availableHeight, width } = size;
  const columnSlots = wordCount >= 7 ? 4 : 3;
  const isNarrowLayout = width < 520;
  const maxCardWidth = Math.min(
    isNarrowLayout ? 92 : CARD_WIDTH,
    Math.floor((width - PLAY_CARD_GAP * (columnSlots - 1)) / columnSlots),
  );
  const cardWidth = Math.max(MIN_PLAY_CARD_WIDTH, maxCardWidth);
  const cardHeight = Math.round(CARD_HEIGHT * (cardWidth / CARD_WIDTH));
  const template = getHorseshoeTemplate(wordCount);
  const maxTemplateX = Math.max(...template.map((point) => Math.abs(point.x)), 1);
  const maxTemplateRow = Math.max(...template.map((point) => point.row), 1);
  const sidePadding = isNarrowLayout ? 4 : cardWidth * 0.5;
  const usableWidth = Math.max(cardWidth, width - sidePadding * 2 - cardWidth);
  const maxLayoutWidth = Math.min(
    MAX_HORSESHOE_WIDTH,
    width - sidePadding * 2,
  );
  const targetWidth = Math.min(
    maxLayoutWidth,
    Math.max(cardWidth * (isNarrowLayout ? 3.25 : 4.35), usableWidth * 0.82),
  );
  const horizontalScale = Math.max(
    cardWidth * 0.78,
    (targetWidth - cardWidth) / (maxTemplateX * 2),
  );
  const reservedBottom = 66;
  const verticalTopPadding = Math.max(cardHeight * 0.5, isNarrowLayout ? 22 : 34);
  const availableContentHeight = Math.max(
    cardHeight,
    availableHeight - reservedBottom - verticalTopPadding,
  );
  const preferredRowStep = cardHeight * (wordCount >= 9 ? 1.42 : wordCount >= 7 ? 1.48 : 1.6);
  const minimumRowStep = cardHeight + (isNarrowLayout ? 6 : 10);
  const rowStep = Math.min(
    preferredRowStep,
    Math.max(
      minimumRowStep,
      (availableContentHeight - cardHeight) / maxTemplateRow,
    ),
  );
  const contentHeight = maxTemplateRow * rowStep + cardHeight;
  const verticalOffset = Math.max(
    verticalTopPadding,
    (availableHeight - reservedBottom - contentHeight) / 2 +
      verticalTopPadding * 0.15,
  );
  const centerX = width / 2;
  const slots = template.map((point) => ({
    left: centerX + point.x * horizontalScale - cardWidth / 2,
    top: verticalOffset + point.row * rowStep,
  }));

  return {
    cardWidth,
    cardHeight,
    height: Math.max(contentHeight, availableHeight),
    slots,
  };
}

export const ConstellationBoard: React.FC = () => {
  const [cards, setCards] = useState<WordCardModel[]>([]);
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [loadingWords, setLoadingWords] = useState(true);
  const [wordLoadError, setWordLoadError] = useState<string | null>(null);

  const cardsById = useMemo(() => {
    const map = new Map<string, WordCardModel>();
    cards.forEach((card) => map.set(card.id, card));
    return map;
  }, [cards]);

  const allCardIds = useMemo(() => Array.from(cardsById.keys()), [cardsById]);

  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [playIds, setPlayIds] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropPreviewIndex, setDropPreviewIndex] = useState<number | null>(null);
  const [hoverZone, setHoverZone] = useState<Zone | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('playing');
  const [submitTries, setSubmitTries] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [unlockedLevelIndex, setUnlockedLevelIndex] = useState(0);
  const [completedLevelIndexes, setCompletedLevelIndexes] = useState<number[]>(
    [],
  );
  const [completedLevelStates, setCompletedLevelStates] = useState<
    CachedCompletedLevelState[]
  >([]);
  const [playAreaFlipped, setPlayAreaFlipped] = useState(false);
  const [playColumnSize, setPlayColumnSize] = useState<PlayColumnSize>({
    height: 0,
    width: 0,
  });

  const containerRef = useRef<RNView>(null);
  const fieldRef = useRef<RNView>(null);
  const playAreaRef = useRef<RNView>(null);
  const playColumnRef = useRef<RNView>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const cacheReadyRef = useRef(false);
  const invalidSubmitShake = useRef(new Animated.Value(0)).current;
  const invalidSubmitFlash = useRef(new Animated.Value(0)).current;
  const fieldLayout = useRef<LayoutRect | null>(null);
  const playLayout = useRef<LayoutRect | null>(null);
  const playColumnLayout = useRef<LayoutRect | null>(null);
  const playItemLayouts = useRef<Map<string, LayoutRect>>(new Map());

  const dragLayerLayout = useRef<LayoutRect | null>(null);

  const draggingCardId = dragState?.cardId ?? null;
  const interactionsLocked =
    gamePhase !== 'playing' || loadingWords || !!wordLoadError || answerKey.length === 0;

  useEffect(() => {
    let cancelled = false;

    async function loadWords() {
      setLoadingWords(true);
      setWordLoadError(null);

      try {
        const cachedState = await readCachedGameState();

        if (cancelled) {
          return;
        }

        if (cachedState) {
          const cachedCurrentLevelIndex = Math.min(
            cachedState.currentLevelIndex,
            GAME_LEVELS.length - 1,
          );
          const cachedUnlockedLevelIndex = Math.min(
            Math.max(cachedState.unlockedLevelIndex, cachedCurrentLevelIndex),
            GAME_LEVELS.length - 1,
          );

          setCurrentLevelIndex(cachedCurrentLevelIndex);
          setUnlockedLevelIndex(cachedUnlockedLevelIndex);
          setCompletedLevelIndexes(
            Array.from(
              new Set(
                cachedState.completedLevelIndexes.filter(
                  (index) => index >= 0 && index < GAME_LEVELS.length,
                ),
              ),
            ),
          );
          setCompletedLevelStates(
            cachedState.completedLevelStates.filter(
              (state) => state.levelIndex >= 0 && state.levelIndex < GAME_LEVELS.length,
            ),
          );
          setCards(cachedState.cards);
          setAnswerKey(cachedState.answerKey);
          setFieldIds(cachedState.fieldIds);
          setPlayIds(cachedState.playIds);
          setGamePhase(cachedState.gamePhase);
          setSubmitTries(cachedState.submitTries);
          setPlayAreaFlipped(cachedState.playAreaFlipped);
          playItemLayouts.current.clear();
          return;
        }

        const response = await fetchGameWords({
          wordCount: GAME_LEVELS[0].wordCount,
        });

        if (cancelled) {
          return;
        }

        setCards(response.words);
        setAnswerKey(response.answerKey);
        setFieldIds(response.words.map((card) => card.id));
        setPlayIds([]);
        setGamePhase('playing');
        setSubmitTries(0);
        setPlayAreaFlipped(false);
        playItemLayouts.current.clear();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setWordLoadError(getServiceErrorMessage(error));
        showServiceOfflineAlert(error);
      } finally {
        if (!cancelled) {
          cacheReadyRef.current = true;
          setLoadingWords(false);
        }
      }
    }

    loadWords();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cacheReadyRef.current || cards.length === 0 || answerKey.length === 0) {
      return;
    }

    writeCachedGameState({
      levelIndex: currentLevelIndex,
      cards,
      answerKey,
      fieldIds,
      playIds,
      gamePhase,
      submitTries,
      playAreaFlipped,
      currentLevelIndex,
      unlockedLevelIndex,
      completedLevelIndexes,
      completedLevelStates,
    });
  }, [
    answerKey,
    cards,
    completedLevelStates,
    completedLevelIndexes,
    currentLevelIndex,
    fieldIds,
    gamePhase,
    playIds,
    playAreaFlipped,
    submitTries,
    unlockedLevelIndex,
  ]);

  const refreshFieldLayout = useCallback(() => {
    measureViewInWindow(fieldRef.current, (rect) => {
      fieldLayout.current = rect;
    });
  }, []);

  const refreshPlayLayout = useCallback(() => {
    measureViewInWindow(playAreaRef.current, (rect) => {
      playLayout.current = rect;
    });
  }, []);

  const refreshPlayColumnLayout = useCallback(() => {
    measureViewInWindow(playColumnRef.current, (rect) => {
      playColumnLayout.current = rect;
    });
  }, []);

  const refreshDragLayerLayout = useCallback(
    (callback?: (rect: LayoutRect) => void) => {
      measureViewInWindow(containerRef.current, (rect) => {
        if (rect.width <= 0 || rect.height <= 0) {
          requestAnimationFrame(() => refreshDragLayerLayout(callback));
          return;
        }

        dragLayerLayout.current = rect;
        callback?.(rect);
      });
    },
    [],
  );

  const onContainerLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      refreshDragLayerLayout();
      requestAnimationFrame(() => refreshDragLayerLayout());
    },
    [refreshDragLayerLayout],
  );

  const handlePlayItemLayout = useCallback((cardId: string, rect: LayoutRect) => {
    const columnLayout = playColumnLayout.current;
    if (!columnLayout) {
      playItemLayouts.current.set(cardId, rect);
      return;
    }

    playItemLayouts.current.set(cardId, {
      x: rect.x - columnLayout.x,
      y: rect.y - columnLayout.y,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const onFieldLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      refreshFieldLayout();
    },
    [refreshFieldLayout],
  );

  const onPlayAreaLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      refreshPlayLayout();
      refreshPlayColumnLayout();
    },
    [refreshPlayColumnLayout, refreshPlayLayout],
  );

  const onPlayColumnLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, width } = event.nativeEvent.layout;
      setPlayColumnSize((current) =>
        current.height === height && current.width === width
          ? current
          : { height, width },
      );
      refreshPlayColumnLayout();
    },
    [refreshPlayColumnLayout],
  );

  const clearDrag = useCallback(() => {
    dragStateRef.current = null;
    setDragState(null);
    setHoverZone(null);
    setDropPreviewIndex(null);
  }, []);

  const resetGame = useCallback(() => {
    clearDrag();
    setFieldIds(cards.map((card) => card.id));
    setPlayIds([]);
    setToastMessage(null);
    setPlayAreaFlipped(false);
    playItemLayouts.current.clear();
    requestAnimationFrame(() => {
      refreshFieldLayout();
      refreshPlayLayout();
      refreshPlayColumnLayout();
    });
  }, [
    cards,
    clearDrag,
    refreshFieldLayout,
    refreshPlayColumnLayout,
    refreshPlayLayout,
  ]);

  const getCurrentLevelState = useCallback((): CachedCompletedLevelState | null => {
    if (cards.length === 0 || answerKey.length === 0) {
      return null;
    }

    return {
      levelIndex: currentLevelIndex,
      cards,
      answerKey,
      fieldIds,
      playIds,
      gamePhase,
      submitTries,
      playAreaFlipped,
    };
  }, [
    answerKey,
    cards,
    currentLevelIndex,
    fieldIds,
    gamePhase,
    playAreaFlipped,
    playIds,
    submitTries,
  ]);

  const loadLevel = useCallback(
    async (levelIndex: number) => {
      const level = GAME_LEVELS[levelIndex];
      if (!level || levelIndex > unlockedLevelIndex) {
        return;
      }

      clearDrag();

      const currentLevelState = getCurrentLevelState();
      const levelStates = currentLevelState
        ? mergeLevelState(completedLevelStates, currentLevelState)
        : completedLevelStates;

      if (currentLevelState) {
        setCompletedLevelStates(levelStates);
      }

      const completedLevelState = levelStates.find(
        (state) => state.levelIndex === levelIndex,
      );

      if (completedLevelState) {
        setCurrentLevelIndex(levelIndex);
        setCards(completedLevelState.cards);
        setAnswerKey(completedLevelState.answerKey);
        setFieldIds(completedLevelState.fieldIds);
        setPlayIds(completedLevelState.playIds);
        setGamePhase(completedLevelState.gamePhase);
        setSubmitTries(completedLevelState.submitTries);
        setPlayAreaFlipped(completedLevelState.playAreaFlipped);
        setToastMessage(null);
        setWordLoadError(null);
        setLoadingWords(false);
        playItemLayouts.current.clear();
        requestAnimationFrame(() => {
          refreshFieldLayout();
          refreshPlayLayout();
          refreshPlayColumnLayout();
        });
        return;
      }

      setLoadingWords(true);
      setWordLoadError(null);
      setToastMessage(null);
      playItemLayouts.current.clear();

      try {
        const response = await fetchGameWords({ wordCount: level.wordCount });

        setCurrentLevelIndex(levelIndex);
        setCards(response.words);
        setAnswerKey(response.answerKey);
        setFieldIds(response.words.map((card) => card.id));
        setPlayIds([]);
        setGamePhase('playing');
        setSubmitTries(0);
        setPlayAreaFlipped(false);
        requestAnimationFrame(() => {
          refreshFieldLayout();
          refreshPlayLayout();
          refreshPlayColumnLayout();
        });
      } catch (error) {
        setWordLoadError(getServiceErrorMessage(error));
        showServiceOfflineAlert(error);
      } finally {
        setLoadingWords(false);
      }
    },
    [
      clearDrag,
      completedLevelStates,
      getCurrentLevelState,
      refreshFieldLayout,
      refreshPlayLayout,
      refreshPlayColumnLayout,
      unlockedLevelIndex,
    ],
  );

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const showInvalidSubmitFeedback = useCallback(() => {
    invalidSubmitShake.stopAnimation();
    invalidSubmitFlash.stopAnimation();
    invalidSubmitShake.setValue(0);
    invalidSubmitFlash.setValue(0);

    Animated.parallel([
      Animated.timing(invalidSubmitShake, {
        duration: 360,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(invalidSubmitFlash, {
          duration: 80,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(invalidSubmitFlash, {
          duration: 280,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      invalidSubmitShake.setValue(0);
      invalidSubmitFlash.setValue(0);
    });
  }, [invalidSubmitFlash, invalidSubmitShake]);

  const getCompletedLevelIndexes = useCallback(
    (levelIndex: number) =>
      completedLevelIndexes.includes(levelIndex)
        ? completedLevelIndexes
        : [...completedLevelIndexes, levelIndex].sort((a, b) => a - b),
    [completedLevelIndexes],
  );

  const getCompletedLevelStates = useCallback(
    (state: CachedCompletedLevelState) =>
      mergeLevelState(completedLevelStates, state),
    [completedLevelStates],
  );

  const getDisplayPlayIds = useCallback(
    (ids: string[]) => (playAreaFlipped ? [...ids].reverse() : ids),
    [playAreaFlipped],
  );

  const getPlayInsertionPoint = useCallback((pointerX: number, pointerY: number) => {
    const layout = playColumnLayout.current;
    if (!layout) {
      return null;
    }

    return {
      x: pointerX - layout.x,
      y: pointerY - layout.y,
    };
  }, []);

  const revealCorrectAnswer = useCallback(
    (
      phase: Extract<GamePhase, 'success' | 'failed'>,
      tries: number,
    ): CachedCompletedLevelState => ({
      levelIndex: currentLevelIndex,
      cards,
      answerKey,
      fieldIds: [],
      playIds: [...answerKey],
      gamePhase: phase,
      submitTries: tries,
      playAreaFlipped: false,
    }),
    [answerKey, cards, currentLevelIndex],
  );

  const getDisplayDropIndex = useCallback(
    (pointerX: number, pointerY: number, displayIdsForInsert: string[]) => {
      const insertionPoint = getPlayInsertionPoint(pointerX, pointerY);
      if (insertionPoint === null) {
        return null;
      }

      return getPathInsertionIndex(
        insertionPoint,
        displayIdsForInsert,
        playItemLayouts.current,
      );
    },
    [getPlayInsertionPoint],
  );

  const toLogicalPlayIds = useCallback(
    (displayIds: string[]) =>
      playAreaFlipped ? [...displayIds].reverse() : displayIds,
    [playAreaFlipped],
  );

  const handleSubmit = useCallback(() => {
    if (interactionsLocked) {
      return;
    }

    const allInPlay = playIds.length === answerKey.length;

    if (!allInPlay) {
      showInvalidSubmitFeedback();
      showToast('All cards must be in play.');
      return;
    }

    if (playOrderMatches(playIds, answerKey)) {
      const completedState = revealCorrectAnswer('success', submitTries);
      const nextCompletedLevelIndexes =
        getCompletedLevelIndexes(currentLevelIndex);
      const nextCompletedLevelStates = getCompletedLevelStates(completedState);
      const nextUnlockedLevelIndex = Math.max(
        unlockedLevelIndex,
        Math.min(currentLevelIndex + 1, GAME_LEVELS.length - 1),
      );

      setFieldIds(completedState.fieldIds);
      setPlayIds(completedState.playIds);
      setPlayAreaFlipped(false);
      setGamePhase('success');
      setCompletedLevelIndexes(nextCompletedLevelIndexes);
      setCompletedLevelStates(nextCompletedLevelStates);
      setUnlockedLevelIndex(nextUnlockedLevelIndex);
      writeCachedGameState({
        levelIndex: currentLevelIndex,
        cards,
        answerKey,
        fieldIds: completedState.fieldIds,
        playIds: completedState.playIds,
        gamePhase: 'success',
        submitTries,
        playAreaFlipped: false,
        currentLevelIndex,
        unlockedLevelIndex: nextUnlockedLevelIndex,
        completedLevelIndexes: nextCompletedLevelIndexes,
        completedLevelStates: nextCompletedLevelStates,
      });
      return;
    }

    const nextTries = submitTries + 1;
    showInvalidSubmitFeedback();
    setSubmitTries(nextTries);

    if (nextTries >= MAX_SUBMIT_TRIES) {
      const failedState = revealCorrectAnswer('failed', nextTries);
      const nextCompletedLevelIndexes =
        getCompletedLevelIndexes(currentLevelIndex);
      const nextCompletedLevelStates = getCompletedLevelStates(failedState);
      const nextUnlockedLevelIndex = Math.max(
        unlockedLevelIndex,
        Math.min(currentLevelIndex + 1, GAME_LEVELS.length - 1),
      );

      setFieldIds(failedState.fieldIds);
      setPlayIds(failedState.playIds);
      setPlayAreaFlipped(false);
      setGamePhase('failed');
      setCompletedLevelIndexes(nextCompletedLevelIndexes);
      setCompletedLevelStates(nextCompletedLevelStates);
      setUnlockedLevelIndex(nextUnlockedLevelIndex);
      writeCachedGameState({
        levelIndex: currentLevelIndex,
        cards,
        answerKey,
        fieldIds: failedState.fieldIds,
        playIds: failedState.playIds,
        gamePhase: 'failed',
        submitTries: nextTries,
        playAreaFlipped: false,
        currentLevelIndex,
        unlockedLevelIndex: nextUnlockedLevelIndex,
        completedLevelIndexes: nextCompletedLevelIndexes,
        completedLevelStates: nextCompletedLevelStates,
      });
    }
  }, [
    answerKey,
    cards,
    currentLevelIndex,
    fieldIds,
    getCompletedLevelIndexes,
    getCompletedLevelStates,
    interactionsLocked,
    playIds,
    revealCorrectAnswer,
    showInvalidSubmitFeedback,
    showToast,
    submitTries,
    unlockedLevelIndex,
  ]);

  const moveCardToPlayEnd = useCallback(
    (cardId: string) => {
      if (interactionsLocked || !fieldIds.includes(cardId)) {
        return;
      }

      setFieldIds((prev) => prev.filter((id) => id !== cardId));
      setPlayIds((prev) => {
        if (prev.includes(cardId)) {
          return prev;
        }
        return playAreaFlipped ? [cardId, ...prev] : [...prev, cardId];
      });
      requestAnimationFrame(() => {
        refreshFieldLayout();
        refreshPlayLayout();
        refreshPlayColumnLayout();
      });
    },
    [
      fieldIds,
      interactionsLocked,
      playAreaFlipped,
      refreshFieldLayout,
      refreshPlayColumnLayout,
      refreshPlayLayout,
    ],
  );

  const moveCardToField = useCallback(
    (cardId: string) => {
      if (interactionsLocked || !playIds.includes(cardId)) {
        return;
      }

      setPlayIds((prev) => prev.filter((id) => id !== cardId));
      setFieldIds((prev) => mergeIntoFieldOrder(prev, cardId, allCardIds));
      requestAnimationFrame(() => {
        refreshFieldLayout();
        refreshPlayLayout();
        refreshPlayColumnLayout();
      });
    },
    [
      allCardIds,
      interactionsLocked,
      playIds,
      refreshFieldLayout,
      refreshPlayColumnLayout,
      refreshPlayLayout,
    ],
  );

  const updateDropPreview = useCallback(
    (x: number, y: number) => {
      if (interactionsLocked) {
        return;
      }

      if (pointInRect(x, y, playLayout.current)) {
        setHoverZone('play');
        const activeCardId = dragStateRef.current?.cardId ?? draggingCardId;
        const displayIdsForInsert = getDisplayPlayIds(playIds).filter(
          (id) => id !== activeCardId,
        );
        const index = getDisplayDropIndex(
          x,
          y,
          displayIdsForInsert,
        );
        console.log('Calculated drop preview index:', index);
        setDropPreviewIndex(index);
        return;
      }

      if (pointInRect(x, y, fieldLayout.current)) {
        setHoverZone('field');
        setDropPreviewIndex(null);
        return;
      }

      setHoverZone(null);
      setDropPreviewIndex(null);
    },
    [
      draggingCardId,
      getDisplayDropIndex,
      getDisplayPlayIds,
      interactionsLocked,
      playIds,
    ],
  );

  const handleDragStart = useCallback(
    (cardId: string, x: number, y: number, cardRect: LayoutRect) => {
      if (interactionsLocked) {
        debugBoardDrag('start ignored: interactions locked', {
          cardId,
          x,
          y,
          interactionsLocked,
        });
        return;
      }
      debugBoardDrag('start', {
        cardId,
        x,
        y,
        cardRect,
        hasDragLayerLayout: Boolean(dragLayerLayout.current),
      });
      const fromZone: Zone = playIds.includes(cardId) ? 'play' : 'field';
      const fromFieldIndex =
        fromZone === 'field' ? fieldIds.indexOf(cardId) : undefined;
      const fromPlayIndex =
        fromZone === 'play' ? playIds.indexOf(cardId) : undefined;
      const dragLayer = dragLayerLayout.current;
      const nextDrag: DragState = {
        cardId,
        fromZone,
        fromFieldIndex,
        fromPlayIndex,
        grabOffsetX: x - cardRect.x,
        grabOffsetY: y - cardRect.y,
        pointerX: x,
        pointerY: y,
        cardWidth: cardRect.width,
        cardHeight: cardRect.height,
        cardStartX: cardRect.x,
        cardStartY: cardRect.y,
        dragLayerX: dragLayer?.x ?? 0,
        dragLayerY: dragLayer?.y ?? 0,
      };

      dragStateRef.current = nextDrag;
      setDragState(nextDrag);
      debugBoardDrag('state set on start', nextDrag);
      updateDropPreview(x, y);
    },
    [
      fieldIds,
      interactionsLocked,
      playIds,
      updateDropPreview,
    ],
  );

  const handleDragMove = useCallback(
    (cardId: string, x: number, y: number) => {
      if (interactionsLocked || dragStateRef.current?.cardId !== cardId) {
        debugBoardDrag('move ignored', {
          cardId,
          x,
          y,
          interactionsLocked,
          activeCardId: dragStateRef.current?.cardId,
        });
        return;
      }
      const nextDrag = {
        ...dragStateRef.current,
        pointerX: x,
        pointerY: y,
      };
      dragStateRef.current = nextDrag;
      setDragState(nextDrag);
      debugBoardDrag('move applied', {
        cardId,
        x,
        y,
        grabOffsetX: nextDrag.grabOffsetX,
        grabOffsetY: nextDrag.grabOffsetY,
      });
      updateDropPreview(x, y);
    },
    [interactionsLocked, updateDropPreview],
  );

  const handleDragEnd = useCallback(
    (cardId: string, x: number, y: number) => {
      if (interactionsLocked) {
        debugBoardDrag('end ignored: interactions locked', { cardId, x, y });
        clearDrag();
        return;
      }
      debugBoardDrag('end', { cardId, x, y });

      const activeDrag = dragStateRef.current;
      if (!activeDrag || activeDrag.cardId !== cardId) {
        debugBoardDrag('end without active drag', {
          cardId,
          activeCardId: activeDrag?.cardId,
        });
        clearDrag();
        return;
      }

      const { fromZone, fromPlayIndex } = activeDrag;

      if (pointInRect(x, y, fieldLayout.current)) {
        debugBoardDrag('drop target field', {
          cardId,
          fromZone,
          fieldLayout: fieldLayout.current,
        });
        if (fromZone === 'field') {
          // Cancel drag — card stays in field at its original slot.
        } else {
          setPlayIds((prev) => prev.filter((id) => id !== cardId));
          setFieldIds((prev) =>
            mergeIntoFieldOrder(prev, cardId, allCardIds),
          );
        }
        clearDrag();
        requestAnimationFrame(() => {
          refreshFieldLayout();
          refreshPlayLayout();
          refreshPlayColumnLayout();
        });
        return;
      }

      if (pointInRect(x, y, playLayout.current)) {
        debugBoardDrag('drop target play', {
          cardId,
          fromZone,
          playLayout: playLayout.current,
        });
        const displayIds = getDisplayPlayIds(playIds);
        const displayIdsForInsert = displayIds.filter((id) => id !== cardId);
        const displayInsertIndex = getDisplayDropIndex(
          x,
          y,
          displayIdsForInsert,
        );
        if (displayInsertIndex === null) {
          debugBoardDrag('play drop missing insert index', { cardId, x, y });
          clearDrag();
          return;
        }

        setFieldIds((prev) => prev.filter((id) => id !== cardId));
        setPlayIds(() => {
          const nextDisplayIds = [...displayIdsForInsert];
          nextDisplayIds.splice(displayInsertIndex, 0, cardId);
          return toLogicalPlayIds(nextDisplayIds);
        });
      } else if (fromZone === 'field') {
        debugBoardDrag('drop outside from field', { cardId, x, y });
        setPlayIds((prev) => prev.filter((id) => id !== cardId));
      } else if (fromPlayIndex !== undefined) {
        debugBoardDrag('drop outside from play: restoring', {
          cardId,
          fromPlayIndex,
        });
        setFieldIds((prev) => prev.filter((id) => id !== cardId));
        setPlayIds((prev) => {
          if (prev.includes(cardId)) {
            return prev;
          }
          const next = [...prev];
          next.splice(fromPlayIndex, 0, cardId);
          return next;
        });
      }

      clearDrag();
      requestAnimationFrame(() => {
        refreshFieldLayout();
        refreshPlayLayout();
        refreshPlayColumnLayout();
      });
    },
    [
      clearDrag,
      allCardIds,
      interactionsLocked,
      getDisplayPlayIds,
      getDisplayDropIndex,
      playIds,
      refreshFieldLayout,
      refreshPlayColumnLayout,
      refreshPlayLayout,
      toLogicalPlayIds,
    ],
  );

  const displayPlayIds = getDisplayPlayIds(playIds);
  const displayPlayIdsForInsert =
    dragState?.fromZone === 'play' && draggingCardId
      ? displayPlayIds.filter((id) => id !== draggingCardId)
      : displayPlayIds;
  const displayPlayIdsKey = displayPlayIds.join('|');
  const displayPlayIdsForInsertKey = displayPlayIdsForInsert.join('|');
  const horseshoeLayout = useMemo(
    () => createHorseshoeLayout(playColumnSize, answerKey.length || 5),
    [answerKey.length, playColumnSize],
  );
  const playCardStyle = useMemo<ViewStyle>(
    () => ({
      height: horseshoeLayout.cardHeight,
      width: horseshoeLayout.cardWidth,
    }),
    [horseshoeLayout.cardHeight, horseshoeLayout.cardWidth],
  );
  const dropPreviewPoint = useMemo(
    () =>
      dropPreviewIndex === null
        ? null
        : getHorseshoeBoundary(horseshoeLayout, dropPreviewIndex),
    [dropPreviewIndex, horseshoeLayout],
  );
  const invalidSubmitTranslateX = invalidSubmitShake.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
    outputRange: [0, -9, 9, -7, 7, -3, 0],
  });

  useEffect(() => {
    const visibleIds = new Set(displayPlayIds);
    playItemLayouts.current.forEach((_layout, cardId) => {
      if (!visibleIds.has(cardId)) {
        playItemLayouts.current.delete(cardId);
      }
    });
    requestAnimationFrame(() => {
      refreshPlayLayout();
      refreshPlayColumnLayout();
    });
  }, [displayPlayIdsKey, refreshPlayColumnLayout, refreshPlayLayout]);

  useEffect(() => {
    if (loadingWords) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      refreshDragLayerLayout();
    });
    const timeout = setTimeout(refreshDragLayerLayout, 250);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [displayPlayIdsKey, loadingWords, refreshDragLayerLayout]);

  const renderActions = () => {
    if (gamePhase === 'success') {
      return (
        <View style={styles.actionColumn}>
          <GameBanner variant="success" />
          <Text style={styles.completedLabel}>Game completed</Text>
        </View>
      );
    }
    if (gamePhase === 'failed') {
      return (
        <View style={styles.actionColumn}>
          <GameBanner variant="failed" />
        </View>
      );
    }

    return (
      <View style={styles.actionColumn}>
        <Text style={styles.triesLabel}>
          Tries: {submitTries}/{MAX_SUBMIT_TRIES}
        </Text>
        <View style={styles.actionRow}>
          <Button title="Reset" onPress={resetGame} variant="secondary" />
          <Button title="Submit" onPress={handleSubmit} />
        </View>
        {toastMessage && (
          <GameToast
            key={toastMessage}
            message={toastMessage}
            durationMs={TOAST_DURATION_MS}
            onDismiss={() => setToastMessage(null)}
          />
        )}
      </View>
    );
  };

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={onContainerLayout}
    >
      <View style={styles.board}>
        {wordLoadError && (
          <View style={[styles.statusPanel, styles.statusPanelError]}>
            <Text style={[styles.statusText, styles.statusTextError]}>
              Unable to load words.
            </Text>
          </View>
        )}
        <View style={styles.levelRow} accessibilityRole="tablist">
          {GAME_LEVELS.map((level, index) => {
            const isSelected = index === currentLevelIndex;
            const isLocked = index > unlockedLevelIndex;
            const isComplete = completedLevelIndexes.includes(index);

            return (
              <Pressable
                key={level.id}
                style={[
                  styles.levelTab,
                  isSelected && styles.levelTabSelected,
                  isComplete && !isSelected && styles.levelTabComplete,
                  isLocked && styles.levelTabLocked,
                ]}
                onPress={() => loadLevel(index)}
                disabled={isLocked || loadingWords}
                accessibilityRole="tab"
                accessibilityState={{
                  disabled: isLocked || loadingWords,
                  selected: isSelected,
                }}
              >
                <Text
                  style={[
                    styles.levelTabText,
                    isSelected && styles.levelTabTextSelected,
                    isLocked && styles.levelTabTextLocked,
                  ]}
                >
                  {isComplete ? '✓' : ['I', 'II', 'III'][index]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Animated.View
          style={[
            styles.playAreaMotion,
            dragState?.fromZone === 'play' && styles.draggingSection,
            { transform: [{ translateX: invalidSubmitTranslateX }] },
          ]}
        >
          <View
            ref={playAreaRef}
            style={[
              styles.section,
              styles.playArea,
              dragState?.fromZone === 'play' && styles.playAreaDragging,
              hoverZone === 'play' && styles.sectionActive,
              interactionsLocked && styles.sectionLocked,
            ]}
            onLayout={onPlayAreaLayout}
            accessibilityLabel="play-area"
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.invalidSubmitFlash,
                { opacity: invalidSubmitFlash },
              ]}
            />
            <Text style={styles.sectionLabel}>play-area</Text>
            <View
              ref={playColumnRef}
              style={[styles.playColumn, { minHeight: horseshoeLayout.height }]}
              onLayout={onPlayColumnLayout}
            >
            {displayPlayIdsForInsert.slice(1).map((cardId, index) => {
              const start = horseshoeLayout.slots[index];
              const end = horseshoeLayout.slots[index + 1];
              if (!start || !end) {
                return null;
              }

              const startCenter = {
                x: start.left + horseshoeLayout.cardWidth / 2,
                y: start.top + horseshoeLayout.cardHeight / 2,
              };
              const endCenter = {
                x: end.left + horseshoeLayout.cardWidth / 2,
                y: end.top + horseshoeLayout.cardHeight / 2,
              };
              const dx = endCenter.x - startCenter.x;
              const dy = endCenter.y - startCenter.y;
              const length = Math.hypot(dx, dy);
              const angle = `${Math.atan2(dy, dx)}rad`;

              return (
                <View
                  key={`line-${cardId}`}
                  pointerEvents="none"
                  style={[
                    styles.constellationLine,
                    {
                      left: startCenter.x,
                      top: startCenter.y - 1.5,
                      transform: [{ rotate: angle }],
                      width: length,
                    },
                  ]}
                />
              );
            })}
            {dropPreviewPoint && hoverZone === 'play' && (
              <View
                pointerEvents="none"
                style={[
                  styles.constellationInsertPreview,
                  {
                    left: dropPreviewPoint.x - 8,
                    top: dropPreviewPoint.y - 8,
                  },
                ]}
              />
            )}
            {displayPlayIdsForInsert.length === 0 && hoverZone !== 'play' && (
              <Text style={[styles.hint, styles.playHint]}>
                Drag cards here to link them
              </Text>
            )}
            {displayPlayIds.map((cardId) => {
              const card = cardsById.get(cardId);
              if (!card) {
                return null;
              }
              const isHiddenDragSource =
                dragState?.fromZone === 'play' && draggingCardId === cardId;
              const visibleIndex = displayPlayIdsForInsert.indexOf(cardId);
              const slotIndex =
                visibleIndex === -1 ? displayPlayIds.indexOf(cardId) : visibleIndex;
              const slot = horseshoeLayout.slots[slotIndex];
              const draggingSlotStyle =
                isHiddenDragSource && dragState && playColumnLayout.current
                  ? {
                      left:
                        dragState.pointerX -
                        playColumnLayout.current.x -
                        dragState.grabOffsetX,
                      position: 'absolute' as const,
                      top:
                        dragState.pointerY -
                        playColumnLayout.current.y -
                        dragState.grabOffsetY,
                      elevation: 90,
                      zIndex: 300,
                    }
                  : null;

              return (
                <PlayAreaCardSlot
                  key={cardId}
                  cardId={cardId}
                  word={card.word}
                  disabled={interactionsLocked}
                  hiddenFromLayout={isHiddenDragSource}
                  layoutKey={`${displayPlayIdsForInsertKey}:${visibleIndex}`}
                  style={
                    draggingSlotStyle ??
                    (slot
                      ? {
                          left: slot.left,
                          position: 'absolute',
                          top: slot.top,
                        }
                      : undefined)
                  }
                  cardStyle={playCardStyle}
                  showConnector={false}
                  showInsertBefore={false}
                  onLayoutMeasured={handlePlayItemLayout}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onPress={moveCardToField}
                />
              );
            })}
          </View>
            {!interactionsLocked && (
              <Pressable
                style={[
                  styles.flipButton,
                  playAreaFlipped && styles.flipButtonActive,
                ]}
                onPress={() => setPlayAreaFlipped((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Flip play area"
              >
                <Text
                  style={[
                    styles.flipButtonText,
                    playAreaFlipped && styles.flipButtonTextActive,
                  ]}
                >
                  ⇄
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        <View
          ref={fieldRef}
          style={[
            styles.section,
            dragState?.fromZone === 'field' && styles.draggingSection,
            hoverZone === 'field' && styles.sectionActive,
            interactionsLocked && styles.sectionLocked,
          ]}
          onLayout={onFieldLayout}
          accessibilityLabel="card-field"
        >
          <Text style={styles.sectionLabel}>card-field</Text>
          <View style={styles.fieldRow}>
            {fieldIds.map((cardId) => {
              const card = cardsById.get(cardId);
              if (!card) {
                return null;
              }
              const isHiddenFieldDragSource =
                dragState?.fromZone === 'field' &&
                draggingCardId === cardId;
              const fieldDragStyle =
                isHiddenFieldDragSource && dragState
                  ? {
                      transform: [
                        {
                          translateX:
                            dragState.pointerX -
                            dragState.grabOffsetX -
                            dragState.cardStartX,
                        },
                        {
                          translateY:
                            dragState.pointerY -
                            dragState.grabOffsetY -
                            dragState.cardStartY,
                        },
                      ],
                      elevation: 80,
                      zIndex: 300,
                    }
                  : undefined;
              return (
                <DraggableWordCard
                  key={cardId}
                  cardId={cardId}
                  word={card.word}
                  disabled={interactionsLocked}
                  containerStyle={fieldDragStyle}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onPress={moveCardToPlayEnd}
                />
              );
            })}
            {fieldIds.length === 0 && (
              <Text style={styles.hint}>Drop cards here</Text>
            )}
          </View>
        </View>

        {loadingWords && (
          <View
            style={styles.loadingOverlay}
            accessibilityRole="progressbar"
            accessibilityLabel="Loading game"
          >
            <View style={styles.loadingPanel}>
              <ActivityIndicator color="#278777" size="large" />
              <Text style={styles.loadingText}>Loading game...</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>{renderActions()}</View>

    </View>
  );
};

const styles = StyleSheet.create({
  actionColumn: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  board: {
    flex: 1,
    gap: 16,
    padding: 16,
    paddingBottom: 8,
    position: 'relative',
  },
  container: {
    flex: 1,
    overflow: 'visible',
    position: 'relative',
  },
  completedLabel: {
    color: '#17665a',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  fieldRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    minHeight: 64,
    overflow: 'visible',
    position: 'relative',
  },
  draggingSection: {
    elevation: 60,
    zIndex: 60,
  },
  footer: {
    borderTopColor: '#e8eaf0',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hint: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  insertPreviewEnd: {
    alignSelf: 'center',
    backgroundColor: '#7986cb',
    borderRadius: 2,
    height: 4,
    marginVertical: 10,
    width: 120,
  },
  invalidSubmitFlash: {
    backgroundColor: 'rgba(225, 29, 72, 0.18)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0,
  },
  flipButton: {
    backgroundColor: '#ffffff',
    borderColor: '#c7cedd',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 10,
    left: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: 10,
    zIndex: 10,
  },
  flipButtonActive: {
    backgroundColor: '#e6f4f1',
    borderColor: '#278777',
  },
  flipButtonText: {
    color: '#465066',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  flipButtonTextActive: {
    color: '#17665a',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  levelTab: {
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
    borderColor: '#d6dbe8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  levelTabLocked: {
    opacity: 0.45,
  },
  levelTabComplete: {
    backgroundColor: '#edf7ed',
    borderColor: '#75a878',
  },
  levelTabSelected: {
    backgroundColor: '#e6f4f1',
    borderColor: '#278777',
  },
  levelTabText: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '700',
  },
  levelTabTextLocked: {
    color: '#777',
  },
  levelTabTextSelected: {
    color: '#17665a',
  },
  constellationInsertPreview: {
    backgroundColor: '#ffffff',
    borderColor: '#278777',
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    position: 'absolute',
    width: 16,
    zIndex: 6,
  },
  constellationLine: {
    backgroundColor: '#7c8dd8',
    borderRadius: 2,
    height: 3,
    opacity: 0.72,
    position: 'absolute',
    transformOrigin: 'left center',
    zIndex: 1,
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(248, 249, 252, 0.92)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: 16,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dfe3f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  loadingText: {
    color: '#465066',
    fontSize: 15,
    fontWeight: '700',
  },
  playArea: {
    flex: 1,
    minHeight: 330,
    overflow: 'hidden',
    position: 'relative',
  },
  playAreaDragging: {
    overflow: 'visible',
    zIndex: 80,
  },
  playAreaMotion: {
    flex: 1,
    position: 'relative',
  },
  playColumn: {
    alignSelf: 'center',
    flex: 1,
    marginBottom: 64,
    maxWidth: 760,
    overflow: 'visible',
    position: 'relative',
    width: '100%',
    zIndex: 20,
  },
  playHint: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 112,
  },
  section: {
    backgroundColor: '#f8f9fc',
    borderColor: '#dfe3f0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    position: 'relative',
  },
  sectionActive: {
    backgroundColor: '#eef1fb',
    borderColor: '#5c6bc0',
  },
  sectionLabel: {
    color: '#5c6bc0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 12,
    textTransform: 'lowercase',
  },
  sectionLocked: {
    opacity: 0.92,
  },
  statusPanel: {
    alignItems: 'center',
    backgroundColor: '#f8f9fc',
    borderColor: '#dfe3f0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  statusPanelError: {
    backgroundColor: '#fff1f2',
    borderColor: '#e11d48',
  },
  statusText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextError: {
    color: '#be123c',
  },
  triesLabel: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
});
