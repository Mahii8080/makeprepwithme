
import React from 'react';
import { Feedback } from '../types';

interface FeedbackCardProps {
  feedback: Feedback;
}

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const color = score >= 8 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400';
    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (score / 10) * circumference;

    return (
        <div className="relative w-16 h-16">
            <svg className="w-full h-full" viewBox="0 0 40 40">
                <circle
                    className="text-gray-600"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                    r="18"
                    cx="20"
                    cy="20"
                />
                <circle
                    className={color}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLineCap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="18"
                    cx="20"
                    cy="20"
                    transform="rotate(-90 20 20)"
                />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${color}`}>
                {score}
            </span>
        </div>
    );
};


export const FeedbackCard: React.FC<FeedbackCardProps> = ({ feedback }) => {
  return (
    <div className="w-full bg-gray-700/50 backdrop-blur-sm border border-gray-600 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-4">
        <ScoreCircle score={feedback.score} />
        <div>
          <h3 className="text-xl font-bold text-white">Feedback</h3>
          <p className="text-sm text-gray-400">Here's a breakdown of your performance.</p>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-blue-400 mb-1">Evaluation:</h4>
        <p className="text-gray-300">{feedback.feedback}</p>
      </div>

      {feedback.nonVerbalFeedback && (
        <div>
            <h4 className="font-semibold text-purple-400 mb-1">Non-Verbal Feedback:</h4>
            <p className="text-gray-300">{feedback.nonVerbalFeedback}</p>
        </div>
      )}
      
      <div>
        <h4 className="font-semibold text-green-400 mb-1">Suggested Answer:</h4>
        <p className="text-gray-300 italic">{feedback.suggestedAnswer}</p>
      </div>
    </div>
  );
};