import { useState, useRef, useCallback } from "react";

interface UseAudioRecordingProps {
  onTranscription: (text: string) => void;
  sourceLanguage;
  targetLanguage;
}

interface UseAudioRecordingReturn {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<void>;
  isConnected: boolean;
  transcription: string;
  error: string | null;
}

interface AudioProcessor {
  source: MediaStreamAudioSourceNode;
  node: AudioWorkletNode;
  audioContext: AudioContext;
}

export const useAudioRecording = ({
  onTranscription,
  sourceLanguage,
  targetLanguage,
}: UseAudioRecordingProps): UseAudioRecordingReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);

      const GLADIA_API_KEY = localStorage.getItem("gladia_api_key");

      if (!GLADIA_API_KEY) {
        setError("Gladia API key not configured");
        return false;
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Initialize Gladia session
      // console.log("Initializing Gladia live session…");

      const response = await fetch("https://api.gladia.io/v2/live", {
        method: "POST",
        headers: {
          "X-Gladia-Key": GLADIA_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          encoding: "wav/pcm", // This is correct, as you will send raw PCM
          sample_rate: 16000,
          bit_depth: 16,
          channels: 1,
          endpointing: 0.05,
          language_config: {
            languages: sourceLanguage == "Auto-Detect" ? [] : [sourceLanguage],
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
        const errorText = await response.text();
        console.error(
          `Gladia session initialization failed: ${response.status} - ${
            errorText || response.statusText
          }`
        );
        throw new Error(
          `Failed to initialize Gladia session: ${
            errorText || response.statusText
          }`
        );
      }

      const { id, url } = await response.json();
      sessionIdRef.current = id;

      // Connect to WebSocket
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        // console.log("Connected to Gladia WebSocket");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // console.log("Received message:", message);

          if (message.type === "transcript" && message.data?.is_final) {
            const text = message.data.utterance?.text;
            if (text) {
              setTranscription(text);
              onTranscription(text);
            }
          } else if (message.type === "error") {
            console.error("Gladia error:", message);
            setError(message.data?.message || "Transcription error");
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection error");
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        // console.log("WebSocket connection closed", {
        //   code: event.code,
        //   reason: event.reason,
        // });
        setIsConnected(false);

        // If the connection closed unexpectedly, set an error
        if (event.code !== 1000) {
          setError(
            `Connection closed unexpectedly: ${
              event.reason || "Unknown reason"
            }`
          );
        }
      };

      // Set up audio context for raw PCM capture
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass({
        sampleRate: 16000,
      });

      const source = audioContext.createMediaStreamSource(stream);

      // Inline AudioWorklet module that forwards raw PCM samples to main thread
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const channel = inputs[0][0];
            if (channel) this.port.postMessage(channel);
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;

      const blobURL = URL.createObjectURL(
        new Blob([workletCode], { type: "application/javascript" })
      );
      await audioContext.audioWorklet.addModule(blobURL);
      URL.revokeObjectURL(blobURL);

      const node = new AudioWorkletNode(audioContext, "pcm-processor");

      node.port.onmessage = ({ data }) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const input = data as Float32Array;
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(pcm.buffer);
      };

      source.connect(node);
      node.connect(audioContext.destination);

      audioProcessorRef.current = { source, node, audioContext };

      return true;
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
      return false;
    }
  }, [onTranscription]);

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      // Stop audio processing
      if (audioProcessorRef.current) {
        const { source, node, audioContext } = audioProcessorRef.current;
        if (source) source.disconnect();
        if (node) node.disconnect();
        if (audioContext && audioContext.state !== "closed") {
          await audioContext.close();
        }
      }

      // Stop audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Send stop signal to WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop_recording" }));
        wsRef.current.close();
      }

      setIsConnected(false);
      audioProcessorRef.current = null;
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
