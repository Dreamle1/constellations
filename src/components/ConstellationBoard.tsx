import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
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
import { getPlayInsertionIndex, pointInRect } from '@utils/dragGeometry';
import { mergeIntoFieldOrder, playOrderMatches } from '@utils/fieldOrder';

import { Button } from './Button';
import { GameBanner } from './GameBanner';
import { GameToast } from './GameToast';
import { WordCard } from './WordCard';
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

  const containerRef = useRef<RNView>(null);
  const fieldRef = useRef<RNView>(null);
  const playAreaRef = useRef<RNView>(null);
  const playColumnRef = useRef<RNView>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const cacheReadyRef = useRef(false);
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
        dragLayerLayout.current = rect;
        callback?.(rect);
      });
    },
    [],
  );

  const onContainerLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      refreshDragLayerLayout();
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
    (_event: LayoutChangeEvent) => {
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

  const loadLevel = useCallback(
    async (levelIndex: number) => {
      const level = GAME_LEVELS[levelIndex];
      if (!level || levelIndex > unlockedLevelIndex) {
        return;
      }

      clearDrag();

      const completedLevelState = completedLevelStates.find(
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
      refreshFieldLayout,
      refreshPlayLayout,
      unlockedLevelIndex,
    ],
  );

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const getCompletedLevelIndexes = useCallback(
    (levelIndex: number) =>
      completedLevelIndexes.includes(levelIndex)
        ? completedLevelIndexes
        : [...completedLevelIndexes, levelIndex].sort((a, b) => a - b),
    [completedLevelIndexes],
  );

  const getCompletedLevelStates = useCallback(
    (state: CachedCompletedLevelState) => [
      ...completedLevelStates.filter(
        (item) => item.levelIndex !== state.levelIndex,
      ),
      state,
    ].sort((a, b) => a.levelIndex - b.levelIndex),
    [completedLevelStates],
  );

  const getDisplayPlayIds = useCallback(
    (ids: string[]) => (playAreaFlipped ? [...ids].reverse() : ids),
    [playAreaFlipped],
  );

  const getPlayInsertionY = useCallback((pointerY: number) => {
    const layout = playColumnLayout.current;
    if (!layout) {
      return null;
    }

    return pointerY - layout.y;
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
    (pointerY: number, displayIdsForInsert: string[]) => {
      const insertionY = getPlayInsertionY(pointerY);
      if (insertionY === null) {
        return null;
      }

      return getPlayInsertionIndex(
        insertionY,
        displayIdsForInsert,
        playItemLayouts.current,
      );
    },
    [getPlayInsertionY],
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
        return;
      }
      console.log('Drag started:', { cardId, x, y, cardRect });
      const beginDrag = (dragLayerRect: LayoutRect) => {
        const fromZone: Zone = playIds.includes(cardId) ? 'play' : 'field';
        const fromFieldIndex =
          fromZone === 'field' ? fieldIds.indexOf(cardId) : undefined;
        const fromPlayIndex =
          fromZone === 'play' ? playIds.indexOf(cardId) : undefined;
        const nextDrag: DragState = {
          cardId,
          fromZone,
          fromFieldIndex,
          fromPlayIndex,
          grabOffsetX: x - cardRect.x,
          grabOffsetY: y - cardRect.y,
          pointerX: x,
          pointerY: y,
          dragLayerX: dragLayerRect.x,
          dragLayerY: dragLayerRect.y,
        };

        dragStateRef.current = nextDrag;
        setDragState(nextDrag);
        updateDropPreview(x, y);
      };

      if (dragLayerLayout.current) {
        beginDrag(dragLayerLayout.current);
        return;
      }

      refreshDragLayerLayout(beginDrag);
    },
    [
      fieldIds,
      interactionsLocked,
      playIds,
      refreshDragLayerLayout,
      updateDropPreview,
    ],
  );

  const handleDragMove = useCallback(
    (cardId: string, x: number, y: number) => {
      if (interactionsLocked || dragStateRef.current?.cardId !== cardId) {
        return;
      }
      console.log('Drag moved:', { cardId, x, y });
      const nextDrag = {
        ...dragStateRef.current,
        pointerX: x,
        pointerY: y,
      };
      dragStateRef.current = nextDrag;
      setDragState(nextDrag);
      updateDropPreview(x, y);
    },
    [interactionsLocked, updateDropPreview],
  );

  const handleDragEnd = useCallback(
    (cardId: string, x: number, y: number) => {
      if (interactionsLocked) {
        clearDrag();
        return;
      }
      console.log('Drag ended:', { cardId, x, y });

      const activeDrag = dragStateRef.current;
      if (!activeDrag || activeDrag.cardId !== cardId) {
        clearDrag();
        return;
      }

      const { fromZone, fromPlayIndex } = activeDrag;

      if (pointInRect(x, y, fieldLayout.current)) {
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
        const displayIds = getDisplayPlayIds(playIds);
        const displayIdsForInsert = displayIds.filter((id) => id !== cardId);
        const displayInsertIndex = getDisplayDropIndex(
          y,
          displayIdsForInsert,
        );
        if (displayInsertIndex === null) {
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
        setPlayIds((prev) => prev.filter((id) => id !== cardId));
      } else if (fromPlayIndex !== undefined) {
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

  const draggingCard = draggingCardId ? cardsById.get(draggingCardId) : null;
  const displayPlayIds = getDisplayPlayIds(playIds);
  const displayPlayIdsForInsert =
    dragState?.fromZone === 'play' && draggingCardId
      ? displayPlayIds.filter((id) => id !== draggingCardId)
      : displayPlayIds;
  const displayPlayIdsKey = displayPlayIds.join('|');
  const displayPlayIdsForInsertKey = displayPlayIdsForInsert.join('|');

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
          <View style={styles.statusPanel}>
            <Text style={styles.statusText}>Unable to load words.</Text>
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
                  {level.label}
                  {isComplete ? ' done' : ''}
                </Text>
                <Text
                  style={[
                    styles.levelWordCount,
                    isSelected && styles.levelTabTextSelected,
                    isLocked && styles.levelTabTextLocked,
                  ]}
                >
                  {level.wordCount} words
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View
          ref={playAreaRef}
          style={[
            styles.section,
            styles.playArea,
            hoverZone === 'play' && styles.sectionActive,
            interactionsLocked && styles.sectionLocked,
          ]}
          onLayout={onPlayAreaLayout}
          accessibilityLabel="play-area"
        >
          <Text style={styles.sectionLabel}>play-area</Text>
          <View
            ref={playColumnRef}
            style={styles.playColumn}
            onLayout={onPlayColumnLayout}
          >
            {displayPlayIdsForInsert.length === 0 && hoverZone !== 'play' && (
              <Text style={styles.hint}>Drag cards here to link them</Text>
            )}
            {displayPlayIds.map((cardId) => {
              const card = cardsById.get(cardId);
              if (!card) {
                return null;
              }
              const isHiddenDragSource =
                dragState?.fromZone === 'play' && draggingCardId === cardId;
              const visibleIndex = displayPlayIdsForInsert.indexOf(cardId);

              return (
                <PlayAreaCardSlot
                  key={cardId}
                  cardId={cardId}
                  word={card.word}
                  disabled={interactionsLocked}
                  hiddenFromLayout={isHiddenDragSource}
                  layoutKey={`${displayPlayIdsForInsertKey}:${visibleIndex}`}
                  showConnector={visibleIndex > 0}
                  showInsertBefore={
                    visibleIndex !== -1 && dropPreviewIndex === visibleIndex
                  }
                  onLayoutMeasured={handlePlayItemLayout}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onPress={moveCardToField}
                />
              );
            })}
            {dropPreviewIndex === displayPlayIdsForInsert.length && (
              <View style={styles.insertPreviewEnd} />
            )}
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
                Flip
              </Text>
            </Pressable>
          )}
        </View>

        <View
          ref={fieldRef}
          style={[
            styles.section,
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
              return (
                <DraggableWordCard
                  key={cardId}
                  cardId={cardId}
                  word={card.word}
                  disabled={interactionsLocked}
                  hidden={isHiddenFieldDragSource}
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

      {draggingCard && dragState && !interactionsLocked && (
        <View
          pointerEvents="none"
          style={[
            styles.floatingCard,
            {
              left:
                dragState.pointerX -
                dragState.grabOffsetX -
                dragState.dragLayerX,
              top:
                dragState.pointerY -
                dragState.grabOffsetY -
                dragState.dragLayerY,
            },
          ]}
        >
          <WordCard cardId={draggingCard.id} word={draggingCard.word} ghost />
        </View>
      )}
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
  },
  floatingCard: {
    elevation: 12,
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 1000,
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
  flipButton: {
    backgroundColor: '#ffffff',
    borderColor: '#c7cedd',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    right: 10,
  },
  flipButtonActive: {
    backgroundColor: '#e6f4f1',
    borderColor: '#278777',
  },
  flipButtonText: {
    color: '#465066',
    fontSize: 12,
    fontWeight: '700',
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
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: '700',
  },
  levelTabTextLocked: {
    color: '#777',
  },
  levelTabTextSelected: {
    color: '#17665a',
  },
  levelWordCount: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
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
    minHeight: 180,
  },
  playColumn: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  section: {
    backgroundColor: '#f8f9fc',
    borderColor: '#dfe3f0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
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
  statusText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  triesLabel: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
});
