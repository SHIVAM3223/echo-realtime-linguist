
import React from 'react';
import { Card } from '@/components/ui/card';

interface TranscriptionDisplayProps {
  text: string;
  language: string;
  isProcessing: boolean;
  title: string;
}

const TranscriptionDisplay = ({ text, language, isProcessing, title }: TranscriptionDisplayProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">{title}</h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
          {language.toUpperCase()}
        </span>
      </div>
      
      <Card className="p-4 min-h-32 bg-slate-50 border-slate-200">
        {text ? (
          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
            {text}
            {isProcessing && (
              <span className="inline-block w-1 h-5 bg-blue-600 ml-1 animate-pulse" />
            )}
          </p>
        ) : (
          <div className="flex items-center justify-center h-24">
            <p className="text-slate-400 text-sm">
              {isProcessing ? 'Listening...' : 'No text yet'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TranscriptionDisplay;
