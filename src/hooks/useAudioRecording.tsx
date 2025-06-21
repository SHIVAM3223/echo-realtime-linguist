
import { useState, useRef, useCallback } from 'react';

interface UseAudioRecordingProps {
  onTranscription: (text: string) => void;
}

interface UseAudioRecordingReturn {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<void>;
  isConnected: boolean;
  transcription: string;
  error: string | null;
}

export const useAudioRecording = ({ onTranscription }: UseAudioRecordingProps): UseAudioRecordingReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const gladiaKey = localStorage.getItem('gladia_api_key');
      if (!gladiaKey) {
        setError('Gladia API key not configured');
        return false;
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      streamRef.current = stream;

      // Initialize Gladia session
      const response = await fetch('https://api.gladia.io/v2/live', {
        method: 'POST',
        headers: {
          'X-Gladia-Key': gladiaKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encoding: 'wav/pcm',
          sample_rate: 16000,
          bit_depth: 16,
          channels: 1,
          language_behaviour: 'automatic single language',
          transcription_hint: 'General conversation',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize Gladia session: ${response.statusText}`);
      }

      const { id, url } = await response.json();
      sessionIdRef.current = id;

      // Connect to WebSocket
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Gladia WebSocket');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);
          
          if (message.type === 'transcript' && message.data?.is_final) {
            const text = message.data.utterance?.text;
            if (text) {
              setTranscription(text);
              onTranscription(text);
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
      };

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          try {
            // Convert blob to base64
            const arrayBuffer = await event.data.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            
            ws.send(JSON.stringify({
              type: 'audio_chunk',
              data: base64,
            }));
          } catch (err) {
            console.error('Error sending audio chunk:', err);
          }
        }
      };

      // Start recording with small chunks
      mediaRecorder.start(100);
      
      return true;
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      return false;
    }
  }, [onTranscription]);

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Stop audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Send stop signal to WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop_recording' }));
        wsRef.current.close();
      }

      setIsConnected(false);
      mediaRecorderRef.current = null;
      wsRef.current = null;
      sessionIdRef.current = null;
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  }, []);

  return {
    startRecording,
    stopRecording,
    isConnected,
    transcription,
    error,
  };
};
