import { useState, useCallback } from "react";

interface UseTextToSpeechReturn {
  speak: (text: string, language: string) => Promise<void>;
  isSpeaking: boolean;
  error: string | null;
}

// Language code mapping for ElevenLabs voices
const VOICE_MAPPING: { [key: string]: string } = {
  en: "9BWtsMINqrJLrRacOk9x", // Aria
  es: "EXAVITQu4vr4xnSDxMaL", // Sarah
  fr: "FGY2WhTYpPnrIDTdsKH5", // Laura
  de: "CwhRBWXzGAHq8TQ4Fs17", // Roger
  it: "IKne3meq5aSn9XLyUdCD", // Charlie
  pt: "TX3LPaxmHKxFdv7VOQHJ", // Liam
  ru: "N2lVS1w4EtoT3dr4eOWO", // Callum
  ja: "SAz9YHcvj6GT2YYXdXww", // River
  ko: "JBFqnCBsd6RMkjVDRZzb", // George
  zh: "XB0fDUnXU5powFXDhCwa", // Charlotte
  ar: "Xb7hH8MSUJpSbSDYk0k2", // Alice
  hi: "XrExE9yKIg1WjnnlVkGX", // Matilda
  default: "9BWtsMINqrJLrRacOk9x", // Aria (English)
};

export const useTextToSpeech = (): UseTextToSpeechReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(
    async (text: string, language: string): Promise<void> => {
      if (!text.trim()) return;

      setIsSpeaking(true);
      setError(null);

      try {
        const elevenlabsKey = localStorage.getItem("elevenlabs_api_key");

        if (!elevenlabsKey) {
          setError("ElevenLabs API key not configured");
          return;
        }

        const voiceId = VOICE_MAPPING[language] || VOICE_MAPPING["default"];
        const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": elevenlabsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.7,
              similarity_boost: 1.0,
              style: 1.0,
              use_speaker_boost: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Text-to-speech failed: ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);

        return new Promise((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setIsSpeaking(false);
            resolve();
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            setIsSpeaking(false);
            reject(new Error("Audio playback failed"));
          };

          audio.play().catch(reject);
        });
      } catch (err) {
        console.error("Text-to-speech error:", err);
        setError(err instanceof Error ? err.message : "Text-to-speech failed");
        setIsSpeaking(false);
      }
    },
    []
  );

  return {
    speak,
    isSpeaking,
    error,
  };
};
