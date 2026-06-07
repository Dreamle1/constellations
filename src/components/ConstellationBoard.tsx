import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import Animated from 'react-native-reanimated';

import {
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
import { useDragSession } from '@/hooks/useDragSession';
import { fetchGameWords } from '@/utils/gameWordsApi';
import {
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

  const containerRef = useRef<RNView>(null);
  const fieldRef = useRef<RNView>(null);
  const playAreaRef = useRef<RNView>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const cacheReadyRef = useRef(false);
  const fieldLayout = useRef<LayoutRect | null>(null);
  const playLayout = useRef<LayoutRect | null>(null);
  const playItemLayouts = useRef<Map<string, LayoutRect>>(new Map());

  const dragSession = useDragSession(containerRef);
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
          setCards(cachedState.cards);
          setAnswerKey(cachedState.answerKey);
          setFieldIds(cachedState.fieldIds);
          setPlayIds(cachedState.playIds);
          setGamePhase(cachedState.gamePhase);
          setSubmitTries(cachedState.submitTries);
          playItemLayouts.current.clear();
          return;
        }

        const response = await fetchGameWords();

        if (cancelled) {
          return;
        }

        setCards(response.words);
        setAnswerKey(response.answerKey);
        setFieldIds(response.words.map((card) => card.id));
        setPlayIds([]);
        setGamePhase('playing');
        setSubmitTries(0);
        playItemLayouts.current.clear();
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load words';
        setWordLoadError(message);
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
      version: 1,
      cards,
      answerKey,
      fieldIds,
      playIds,
      gamePhase,
      submitTries,
    });
  }, [answerKey, cards, fieldIds, gamePhase, playIds, submitTries]);

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

  const handlePlayItemLayout = useCallback((cardId: string, rect: LayoutRect) => {
    playItemLayouts.current.set(cardId, rect);
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
    },
    [refreshPlayLayout],
  );

  const clearDrag = useCallback(() => {
    dragStateRef.current = null;
    setDragState(null);
    setHoverZone(null);
    setDropPreviewIndex(null);
    dragSession.endDrag();
  }, [dragSession]);

  const resetGame = useCallback(() => {
    clearDrag();
    setFieldIds(cards.map((card) => card.id));
    setPlayIds([]);
    setToastMessage(null);
    playItemLayouts.current.clear();
    requestAnimationFrame(() => {
      refreshFieldLayout();
      refreshPlayLayout();
    });
  }, [cards, clearDrag, refreshFieldLayout, refreshPlayLayout]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

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
      setGamePhase('success');
      return;
    }

    const nextTries = submitTries + 1;
    setSubmitTries(nextTries);

    if (nextTries >= MAX_SUBMIT_TRIES) {
      setGamePhase('failed');
    }
  }, [answerKey, interactionsLocked, playIds, showToast, submitTries]);

  const moveCardToPlayEnd = useCallback(
    (cardId: string) => {
      if (interactionsLocked || !fieldIds.includes(cardId)) {
        return;
      }

      setFieldIds((prev) => prev.filter((id) => id !== cardId));
      setPlayIds((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]));
      requestAnimationFrame(() => {
        refreshFieldLayout();
        refreshPlayLayout();
      });
    },
    [fieldIds, interactionsLocked, refreshFieldLayout, refreshPlayLayout],
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
      });
    },
    [
      allCardIds,
      interactionsLocked,
      playIds,
      refreshFieldLayout,
      refreshPlayLayout,
    ],
  );

  const getPlayInsertionY = useCallback((pointerY: number) => {
    return (
      pointerY + (dragStateRef.current?.pointerToCardCenterOffsetY ?? 0)
    );
  }, []);

  const updateDropPreview = useCallback(
    (x: number, y: number) => {
      if (interactionsLocked) {
        return;
      }

      if (pointInRect(x, y, playLayout.current)) {
        setHoverZone('play');
        const activeCardId = dragStateRef.current?.cardId ?? draggingCardId;
        const playIdsForInsert = playIds.filter((id) => id !== activeCardId);
        const index = getPlayInsertionIndex(
          getPlayInsertionY(y),
          playIdsForInsert,
          playItemLayouts.current,
        );
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
    [draggingCardId, getPlayInsertionY, interactionsLocked, playIds],
  );

  const handleDragStart = useCallback(
    (cardId: string, x: number, y: number, cardRect: LayoutRect) => {
      if (interactionsLocked) {
        return;
      }

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
        pointerToCardCenterOffsetY: cardRect.y + cardRect.height / 2 - y,
      };

      dragStateRef.current = nextDrag;
      setDragState(nextDrag);
      dragSession.beginDrag(x, y, cardRect);
      updateDropPreview(x, y);
    },
    [fieldIds, interactionsLocked, playIds, dragSession, updateDropPreview],
  );

  const handleDragMove = useCallback(
    (cardId: string, x: number, y: number) => {
      if (interactionsLocked || dragStateRef.current?.cardId !== cardId) {
        return;
      }
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
        });
        return;
      }

      if (pointInRect(x, y, playLayout.current)) {
        const playIdsForInsert = playIds.filter((id) => id !== cardId);
        const insertIndex = getPlayInsertionIndex(
          getPlayInsertionY(y),
          playIdsForInsert,
          playItemLayouts.current,
        );

        setFieldIds((prev) => prev.filter((id) => id !== cardId));
        setPlayIds((prev) => {
          const next = prev.filter((id) => id !== cardId);
          next.splice(insertIndex, 0, cardId);
          return next;
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
      });
    },
    [
      clearDrag,
      allCardIds,
      interactionsLocked,
      getPlayInsertionY,
      playIds,
      refreshFieldLayout,
      refreshPlayLayout,
    ],
  );

  const draggingCard = draggingCardId ? cardsById.get(draggingCardId) : null;

  const renderActions = () => {
    if (gamePhase === 'success') {
      return (
        <View style={styles.actionColumn}>
          <GameBanner variant="success" />
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
    <View ref={containerRef} style={styles.container}>
      <View style={styles.board}>
        {loadingWords && (
          <View style={styles.statusPanel}>
            <Text style={styles.statusText}>Loading words...</Text>
          </View>
        )}
        {wordLoadError && (
          <View style={styles.statusPanel}>
            <Text style={styles.statusText}>Unable to load words.</Text>
          </View>
        )}
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
          <View style={styles.playColumn}>
            {playIds.length === 0 && hoverZone !== 'play' && (
              <Text style={styles.hint}>Drag cards here to link them</Text>
            )}
            {playIds.map((cardId, index) => {
              const card = cardsById.get(cardId);
              if (!card) {
                return null;
              }

              const playIdsForInsert = playIds.filter(
                (id) => id !== draggingCardId,
              );

              return (
                <PlayAreaCardSlot
                  key={cardId}
                  cardId={cardId}
                  word={card.word}
                  isDragging={draggingCardId === cardId}
                  disabled={interactionsLocked}
                  showConnector={index > 0}
                  showInsertBefore={
                    dropPreviewIndex === playIdsForInsert.indexOf(cardId)
                  }
                  fingerX={dragSession.fingerX}
                  fingerY={dragSession.fingerY}
                  onLayoutMeasured={handlePlayItemLayout}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onPress={moveCardToField}
                />
              );
            })}
            {dropPreviewIndex ===
              playIds.filter((id) => id !== draggingCardId).length && (
              <View style={styles.insertPreviewEnd} />
            )}
          </View>
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
              return (
                <DraggableWordCard
                  key={cardId}
                  cardId={cardId}
                  word={card.word}
                  isDragging={draggingCardId === cardId}
                  disabled={interactionsLocked}
                  fingerX={dragSession.fingerX}
                  fingerY={dragSession.fingerY}
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

        {draggingCard && !interactionsLocked && (
          <Animated.View
            pointerEvents="none"
            style={[styles.floatingCard, dragSession.floatingStyle]}
          >
            <WordCard cardId={draggingCard.id} word={draggingCard.word} />
          </Animated.View>
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
  },
  container: {
    flex: 1,
    overflow: 'visible',
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
    position: 'absolute',
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
    marginTop: 4,
    width: 120,
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
