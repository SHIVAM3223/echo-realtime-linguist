import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Mic, MicOff, Volume2 } from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import AudioVisualizer from "@/components/AudioVisualizer";
import TranscriptionDisplay from "@/components/TranscriptionDisplay";
import SettingsModal from "@/components/SettingsModal";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { useTranslation } from "@/hooks/useTranslation";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

const Index = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState("Auto-Detect");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Ref to keep track of the text that has already been spoken
  const lastSpokenTranslatedTextRef = useRef("");
  // Timer for debouncing TTS to wait for sentence completion
  const ttsDebounceTimerRef = useRef(null);

  const {
    startRecording,
    stopRecording,
    isConnected,
    error: audioError,
  } = useAudioRecording({
    onTranscription: (newTextChunk) => {
      setSourceText((prevText) => {
        // This logic ensures proper spacing between chunks
        // Check if prevText ends with a punctuation or space, or if newTextChunk starts with space
        const needsSpace =
          prevText.length > 0 &&
          newTextChunk.length > 0 &&
          !prevText.endsWith(" ") &&
          !newTextChunk.startsWith(" ") &&
          !/[.?!]$/.test(prevText.trim()); // Also add space if previous doesn't end with punctuation

        return prevText + (needsSpace ? " " : "") + newTextChunk;
      });
    },
    sourceLanguage,
    targetLanguage,
  });

  const {
    translateText,
    isTranslating,
    error: translationError,
  } = useTranslation();

  const { speak, isSpeaking, error: ttsError } = useTextToSpeech();

  // Auto-translate when source text changes
  useEffect(() => {
    if (sourceText && sourceText.trim().length > 0) {
      const translateAsync = async () => {
        const translated = await translateText(
          sourceText,
          sourceLanguage,
          targetLanguage
        );
        if (translated) {
          setTranslatedText(translated);
        }
      };
      translateAsync();
    } else {
      setTranslatedText("");
    }
  }, [sourceText, sourceLanguage, targetLanguage, translateText]);

  // Effect to manage Text-to-Speech playback
  useEffect(() => {
    // Clear any existing debounce timer
    if (ttsDebounceTimerRef.current) {
      clearTimeout(ttsDebounceTimerRef.current);
    }

    // Don't speak if there's no translated text or if already speaking
    if (!translatedText.trim() || isSpeaking) {
      return;
    }

    // Extract the new, unspoken portion of the translated text
    const newTranslatedPortion = translatedText
      .substring(lastSpokenTranslatedTextRef.current.length)
      .trim();

    if (!newTranslatedPortion) {
      // Nothing new to speak
      return;
    }

    // Heuristic for sentence completion: ends with punctuation or a significant pause indicator.
    // This is the most challenging part for real-time.
    const endsWithPunctuation = /[.?!]$/.test(newTranslatedPortion);
    const endsWithNaturalPause = /[.,;!?]$/.test(newTranslatedPortion); // Consider commas, semicolons as natural pauses too

    // If a sentence is complete, speak it immediately
    if (endsWithPunctuation) {
      speak(newTranslatedPortion, targetLanguage);
      lastSpokenTranslatedTextRef.current = translatedText; // Update reference for spoken text
    } else if (isRecording) {
      // If still recording, and no punctuation,
      // set a debounce to speak if there's a pause in new content.
      // Adjust this delay (e.g., 500ms to 1000ms) based on desired responsiveness vs. completeness.
      ttsDebounceTimerRef.current = setTimeout(() => {
        if (
          !isSpeaking &&
          translatedText
            .substring(lastSpokenTranslatedTextRef.current.length)
            .trim() === newTranslatedPortion
        ) {
          // Speak the current new portion if no new updates arrived during debounce
          speak(newTranslatedPortion, targetLanguage);
          lastSpokenTranslatedTextRef.current = translatedText;
        }
      }, 700); // Wait 700ms for more content or a punctuation mark
    } else if (!isRecording && newTranslatedPortion) {
      // If recording has stopped, speak any remaining new portion immediately
      speak(newTranslatedPortion, targetLanguage);
      lastSpokenTranslatedTextRef.current = translatedText;
    }

    // Cleanup function for useEffect
    return () => {
      if (ttsDebounceTimerRef.current) {
        clearTimeout(ttsDebounceTimerRef.current);
      }
    };
  }, [translatedText, isSpeaking, isRecording, speak, targetLanguage]);

  // When recording stops, ensure any remaining translated text is spoken
  const handleRecordingToggle = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      setIsRecording(false);
      // On stop, clear the debounce and immediately speak any remaining text
      if (ttsDebounceTimerRef.current) {
        clearTimeout(ttsDebounceTimerRef.current);
      }
      const remainingText = translatedText
        .substring(lastSpokenTranslatedTextRef.current.length)
        .trim();
      if (remainingText && !isSpeaking) {
        speak(remainingText, targetLanguage);
        lastSpokenTranslatedTextRef.current = translatedText;
      }
    } else {
      setSourceText("");
      setTranslatedText("");
      lastSpokenTranslatedTextRef.current = ""; // Reset spoken text for new recording
      if (ttsDebounceTimerRef.current) {
        clearTimeout(ttsDebounceTimerRef.current);
      }
      const success = await startRecording();
      if (success) {
        setIsRecording(true);
      }
    }
  }, [
    isRecording,
    stopRecording,
    translatedText,
    lastSpokenTranslatedTextRef,
    isSpeaking,
    speak,
    targetLanguage,
    startRecording,
  ]);

  const hasApiKeys = () => {
    const gladiaKey = localStorage.getItem("gladia_api_key");
    const azureKey = localStorage.getItem("azure_api_key");
    const elevenlabsKey = localStorage.getItem("elevenlabs_api_key");
    return gladiaKey && azureKey && elevenlabsKey;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">
                Real-Time Speech Translator
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasApiKeys() && (
          <Card className="p-6 mb-8 bg-amber-50 border-amber-200">
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-medium text-amber-800">
                  Configuration Required
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  Please configure your API keys in the settings to use the
                  translator.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Source Language Section */}
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Source Language
                </h2>
                <LanguageSelector
                  value={sourceLanguage}
                  onChange={setSourceLanguage}
                  label="From"
                  allowAutoDetect={true}
                />
              </div>

              {/* Recording Controls */}
              <div className="flex items-center space-x-4 mb-6">
                <Button
                  onClick={handleRecordingToggle}
                  disabled={!hasApiKeys()}
                  className={`flex items-center space-x-2 px-6 py-3 ${
                    isRecording
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      <span>Stop Recording</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      <span>Start Recording</span>
                    </>
                  )}
                </Button>

                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span>{isConnected ? "Connected" : "Disconnected"}</span>
                </div>
              </div>

              {/* Audio Visualizer */}
              {isRecording && (
                <AudioVisualizer
                  audioLevel={audioLevel}
                  isActive={isRecording}
                />
              )}

              {/* Source Transcription */}
              <TranscriptionDisplay
                text={sourceText}
                language={sourceLanguage}
                isProcessing={isRecording}
                title="Live Transcription"
              />

              {/* Error Display */}
              {audioError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{audioError}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Target Language Section */}
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  Target Language
                </h2>
                <LanguageSelector
                  value={targetLanguage}
                  onChange={setTargetLanguage}
                  label="To"
                />
              </div>

              <div className="flex items-center space-x-4 mb-6">
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isTranslating
                        ? "bg-blue-500 animate-pulse"
                        : "bg-slate-300"
                    }`}
                  />
                  <span>{isTranslating ? "Translating..." : "Ready"}</span>
                </div>
              </div>

              {/* Translated Text */}
              <TranscriptionDisplay
                text={translatedText}
                language={targetLanguage}
                isProcessing={isTranslating}
                title="Translation"
              />

              {/* Translation Error */}
              {translationError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{translationError}</p>
                </div>
              )}

              {/* TTS Error */}
              {ttsError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{ttsError}</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default Index;
