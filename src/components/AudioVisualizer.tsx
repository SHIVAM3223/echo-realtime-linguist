
import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

interface AudioVisualizerProps {
  audioLevel: number;
  isActive: boolean;
}

const AudioVisualizer = ({ audioLevel, isActive }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (isActive) {
        // Draw waveform bars
        const barCount = 32;
        const barWidth = width / barCount;

        for (let i = 0; i < barCount; i++) {
          const barHeight = Math.random() * height * 0.8 * (audioLevel * 0.01 + 0.1);
          const x = i * barWidth;
          const y = (height - barHeight) / 2;

          // Gradient for bars
          const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
          gradient.addColorStop(0, '#3B82F6');
          gradient.addColorStop(1, '#1D4ED8');

          ctx.fillStyle = gradient;
          ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
        }
      }

      if (isActive) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, isActive]);

  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="flex items-center space-x-3 mb-3">
        <Activity className="w-5 h-5 text-blue-600" />
        <span className="text-sm font-medium text-slate-700">
          Audio Visualization
        </span>
        {isActive && (
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-600">LIVE</span>
          </div>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        className="w-full h-16 bg-white rounded border border-slate-100"
      />
    </div>
  );
};

export default AudioVisualizer;
