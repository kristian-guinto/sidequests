'use client';

import React, { useState, useEffect } from 'react';
import {
  ClientPromptItem,
  CompletionStats,
  EvaluationResult,
  GroupedAnswersPrompt,
  TierId,
  UserAnswerRecord,
} from '@/lib/types';
import {
  getPlayerId,
  getSavedDailyState,
  saveDailyState,
  updateUserStatsOnComplete,
} from '@/lib/storage';
import { DepthTracker } from './DepthTracker';
import { ActivePromptCard } from './ActivePromptCard';
import { ResultsModal } from './ResultsModal';
import { OceanEnvironment } from './OceanEnvironment';

interface GameContainerProps {
  dayNumber: number;
  dateStr: string;
  prompts: ClientPromptItem[];
  title?: string;
}

export function GameContainer({
  dayNumber,
  dateStr,
  prompts,
  title,
}: GameContainerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswerRecord[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stats, setStats] = useState<CompletionStats | null>(null);
  const [answersPrompts, setAnswersPrompts] = useState<GroupedAnswersPrompt[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlunging, setIsPlunging] = useState(false);
  const [lastTier, setLastTier] = useState<TierId | null>(null);

  // Check saved state for today's daily dive
  useEffect(() => {
    const saved = getSavedDailyState(dayNumber, dateStr);
    if (!saved) return;

    if (saved.completed) {
      setAnswers(saved.answers || []);
      setIsCompleted(true);
      if (saved.stats) {
        setStats(saved.stats);
      }
      fetchAnswerExplorer(dayNumber);
    } else if (Array.isArray(saved.answers) && saved.answers.length > 0) {
      // In-progress dive: resume where the player left off!
      setAnswers(saved.answers);
      const nextIdx = typeof saved.currentIndex === 'number'
        ? saved.currentIndex
        : saved.answers.length;

      if (nextIdx >= prompts.length && prompts.length > 0) {
        completeDiveWithAnswers(saved.answers);
      } else {
        setCurrentIndex(Math.max(0, Math.min(nextIdx, prompts.length - 1)));
      }
    }
  }, [dayNumber, dateStr, prompts.length]);

  const fetchAnswerExplorer = async (dayNum: number) => {
    try {
      const res = await fetch(`/api/dive/${dayNum}/answers`);
      if (res.ok) {
        const data = await res.json();
        setAnswersPrompts(data.prompts || []);
      }
    } catch {
      // ignore
    }
  };

  const handlePlungeStart = (evalResult: EvaluationResult) => {
    setIsPlunging(true);
    setLastTier(evalResult.tier);
    setTimeout(() => {
      setIsPlunging(false);
    }, 1400);
  };

  const handleEvaluateAnswer = async (rawAnswer: string): Promise<EvaluationResult> => {
    const currentPrompt = prompts[currentIndex];
    if (!currentPrompt) {
      return {
        matched: false,
        tier: 'miss',
        score: 0,
        canonicalAnswer: null,
        quip: 'No prompt available.',
      };
    }

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptId: currentPrompt.id,
        rawAnswer,
      }),
    });

    const data: EvaluationResult = await res.json();

    const record: UserAnswerRecord = {
      promptId: currentPrompt.id,
      answer: rawAnswer,
      score: data.score,
      tier: data.tier,
      canonicalAnswer: data.canonicalAnswer,
    };

    const updatedAnswers = [...answers];
    updatedAnswers[currentIndex] = record;
    setAnswers(updatedAnswers);

    const updatedScore = updatedAnswers.reduce((sum, a) => sum + (a?.score || 0), 0);
    // Persist in-progress round
    saveDailyState({
      dayNumber,
      date: dateStr,
      completed: false,
      score: updatedScore,
      answers: updatedAnswers,
      currentIndex,
    });

    return data;
  };

  const handleNextPrompt = async () => {
    if (currentIndex + 1 < prompts.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const curScore = answers.reduce((sum, a) => sum + (a?.score || 0), 0);
      saveDailyState({
        dayNumber,
        date: dateStr,
        completed: false,
        score: curScore,
        answers,
        currentIndex: nextIdx,
      });
    } else {
      // Dive completed!
      await handleCompleteDive();
    }
  };

  const handleCompleteDive = async () => {
    await completeDiveWithAnswers(answers);
  };

  const completeDiveWithAnswers = async (finalAnswers: UserAnswerRecord[]) => {
    setIsLoading(true);
    const totalScore = finalAnswers.reduce((sum, a) => sum + (a?.score || 0), 0);
    const playerId = getPlayerId();

    try {
      const res = await fetch('/api/today/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayNumber,
          date: dateStr,
          playerId,
          score: totalScore,
          answers: finalAnswers,
        }),
      });

      let compStats: CompletionStats | null = null;
      if (res.ok) {
        const data = await res.json();
        compStats = {
          betterThan: data.betterThan,
          dist: data.dist,
          totalPlayers: data.totalPlayers,
        };
        setStats(compStats);
      }

      saveDailyState({
        dayNumber,
        date: dateStr,
        completed: true,
        score: totalScore,
        answers: finalAnswers,
        stats: compStats || undefined,
        completedAt: new Date().toISOString(),
      });
      updateUserStatsOnComplete(dateStr, totalScore);

      await fetchAnswerExplorer(dayNumber);
      setIsCompleted(true);
    } catch {
      setIsCompleted(true);
    } finally {
      setIsLoading(false);
    }
  };

  const currentScore = answers.reduce((sum, a) => sum + (a?.score || 0), 0);
  const activePrompt = prompts[currentIndex];

  if (isCompleted) {
    return (
      <>
        <OceanEnvironment
          depthMeters={currentScore * 10}
          isPlunging={isPlunging}
          lastTier={lastTier}
        />
        <ResultsModal
          dayNumber={dayNumber}
          dateStr={dateStr}
          totalScore={currentScore}
          userAnswers={answers}
          prompts={prompts}
          stats={stats}
          answersPrompts={answersPrompts}
        />
      </>
    );
  }

  if (!activePrompt) {
    return (
      <>
        <OceanEnvironment
          depthMeters={currentScore * 10}
          isPlunging={isPlunging}
          lastTier={lastTier}
        />
        <div className="text-center py-12 text-slate-400 font-arcade text-lg tracking-wider">
          PREPARING DIVE EQUIPMENT & SONAR SENSORS...
        </div>
      </>
    );
  }

  return (
    <>
      <OceanEnvironment
        depthMeters={currentScore * 10}
        isPlunging={isPlunging}
        lastTier={lastTier}
      />
      <div className="w-full max-w-2xl mx-auto space-y-4 relative z-10">
        {/* Visual Depth Tracker */}
        <DepthTracker
          currentPromptIndex={currentIndex}
          totalPrompts={prompts.length}
          userAnswers={answers}
          currentScore={currentScore}
          isPlunging={isPlunging}
        />

        {/* Active Question Card */}
        <ActivePromptCard
          key={activePrompt.id}
          prompt={activePrompt}
          promptNumber={currentIndex + 1}
          totalPrompts={prompts.length}
          onEvaluate={handleEvaluateAnswer}
          onNext={handleNextPrompt}
          onPlungeStart={handlePlungeStart}
        />
      </div>
    </>
  );
}
