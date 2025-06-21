import { useState, useRef, useCallback } from "react";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface UseAudioRecordingProps {
  onTranscription: (text: string) => void;
  targetLanguage: string;
  sourceLanguage?: string; // Add source language as an optional prop
}

interface UseAudioRecordingReturn {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<void>;
  isConnected: boolean;
  transcription: string;
  error: string | null;
}

export const useAudioRecording = ({
  onTranscription,
  targetLanguage,
  sourceLanguage = "en-US", // Default to en-US if not provided
}: UseAudioRecordingProps): UseAudioRecordingReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null); // New ref for AudioContext

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);

      const gladiaKey = localStorage.getItem("gladia_api_key");
      if (!gladiaKey) {
        setError("Gladia API key not configured");
        return false;
      }

      // Initialize AudioContext *once* per session for resampling
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)({
          sampleRate: 16000, // Target sample rate for PCM output
        });
      }

      if (audioContextRef.current.state === "suspended") {
        console.log("AudioContext is suspended. Attempting to resume...");
        await audioContextRef.current.resume();
        console.log(
          "AudioContext state after resume:",
          audioContextRef.current.state
        );
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // Request 16kHz from mic if possible
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Initialize Gladia session
      const response = await fetch("https://api.gladia.io/v2/live", {
        method: "POST",
        headers: {
          "X-Gladia-Key": gladiaKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          encoding: "wav/pcm", // This is correct, as you will send raw PCM
          sample_rate: 16000,
          bit_depth: 16,
          channels: 1,
          endpointing: 1,
          language_config: {
            code_switching: true,
          },
          pre_processing: {
            speech_threshold: 0.4, // Good starting point
          },
          realtime_processing: {
            translation: true,
            translation_config: {
              target_languages: [targetLanguage],
              context_adaptation: true,
              // Removed context_mode and context: true
              // context: "optional context string if needed"
            },
            sentiment_analysis: true,
          },
          callback_config: {
            receive_final_transcripts: true,
            receive_speech_events: true,
            receive_pre_processing_events: false,
            receive_realtime_processing_events: false,
            receive_partial_transcripts: true,
            receive_post_processing_events: false,
            receive_acknowledgments: true,
            receive_errors: true,
            receive_lifecycle_events: true,
          },
          messages_config: {
            receive_final_transcripts: true,
            receive_speech_events: true,
            receive_pre_processing_events: false,
            receive_realtime_processing_events: false,
            receive_partial_transcripts: true,
            receive_post_processing_events: false,
            receive_acknowledgments: true,
            receive_errors: true,
            receive_lifecycle_events: true,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(
          `Failed to initialize Gladia session: ${response.status} ${
            response.statusText
          } - ${JSON.stringify(
            errorBody.validation_errors || errorBody.message
          )}`
        );
      }

      const { id, url } = await response.json();
      sessionIdRef.current = id;

      // Connect to WebSocket
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to Gladia WebSocket");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message:", message); // Log ALL messages for debugging

          if (message.type === "transcript") {
            // Check for both final and partial transcripts
            if (message.data?.is_final) {
              const text = message.data.utterance?.text;
              if (text) {
                setTranscription(text);
                onTranscription(text);
                console.log("FINAL Transcript:", text);
              }
            } else if (message.data?.utterance?.text) {
              console.log("PARTIAL Transcript:", message.data.utterance.text);
            }
          } else if (message.type === "speech_started") {
            console.log("--- SPEECH STARTED ---");
          } else if (message.type === "speech_ended") {
            console.log("--- SPEECH ENDED ---");
          } else if (message.type === "error") {
            console.error("GLADIA SERVER ERROR:", message);
            setError(
              `Gladia Error: ${message.error?.message || "Unknown error"}`
            );
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          setError("Error parsing server message.");
        }
      };

      ws.onerror = (errorEvent) => {
        console.error("WebSocket error:", errorEvent);
        setError("WebSocket connection error");
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
      };

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus", // Keep this, as we'll transcode its output
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (
          event.data.size > 0 &&
          ws.readyState === WebSocket.OPEN &&
          audioContextRef.current
        ) {
          try {
            console.log("--- New ondataavailable chunk ---");
            console.log("event.data type:", event.data.type); // Should be "audio/webm;codecs=opus"
            console.log("event.data size:", event.data.size);

            const currentAudioContext = audioContextRef.current;
            const arrayBuffer = await event.data.arrayBuffer();

            console.log("arrayBuffer byteLength:", arrayBuffer.byteLength); // Should match event.data.size

            const audioBuffer = await currentAudioContext.decodeAudioData(
              arrayBuffer
            ); // Decode Opus to AudioBuffer

            // Resample if necessary and convert to 16-bit PCM
            // Create a buffer for the 16-bit PCM data
            // We assume mono output (channelCount: 1) and target 16kHz
            const pcmData = audioBuffer.getChannelData(0); // Get the first channel (mono)
            const int16Array = new Int16Array(pcmData.length);

            for (let i = 0; i < pcmData.length; i++) {
              int16Array[i] = Math.max(-1, Math.min(1, pcmData[i])) * 0x7fff;
            }

            // Convert Int16Array to Uint8Array for Base64 encoding
            const uint8Array = new Uint8Array(int16Array.buffer);

            // Convert Uint8Array to a binary string for btoa
            let binaryString = "";
            for (let i = 0; i < uint8Array.byteLength; i++) {
              binaryString += String.fromCharCode(uint8Array[i]);
            }

            const base64 = btoa(binaryString);

            ws.send(
              JSON.stringify({
                type: "audio_chunk",
                data: {
                  chunk: base64, // Keep this nesting if the API expects it from your previous Part 1 example
                },
              })
            );
            // console.log("Sent PCM audio chunk. Size:", uint8Array.byteLength); // Debugging
          } catch (err) {
            console.error("Error processing and sending audio chunk:", err);
            setError(
              `Audio processing error: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      };

      // Start recording with small chunks (e.g., 100ms)
      mediaRecorder.start(100);

      return true;
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
      return false;
    }
  }, [onTranscription, targetLanguage, sourceLanguage]); // Added sourceLanguage to dependencies

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      // Stop MediaRecorder
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      // Stop audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Close AudioContext
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Send stop signal to WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop_recording" }));
        wsRef.current.close();
      }

      setIsConnected(false);
      mediaRecorderRef.current = null;
      wsRef.current = null;
      sessionIdRef.current = null;
    } catch (err) {
      console.error("Error stopping recording:", err);
      setError(err instanceof Error ? err.message : "Failed to stop recording");
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
