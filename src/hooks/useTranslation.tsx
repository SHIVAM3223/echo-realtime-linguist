
import { useState, useCallback } from 'react';

interface UseTranslationReturn {
  translateText: (text: string, sourceLanguage: string, targetLanguage: string) => Promise<string | null>;
  isTranslating: boolean;
  error: string | null;
}

export const useTranslation = (): UseTranslationReturn => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translateText = useCallback(async (
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string | null> => {
    if (!text.trim()) return null;
    
    setIsTranslating(true);
    setError(null);

    try {
      const azureKey = localStorage.getItem('azure_api_key');
      const azureRegion = localStorage.getItem('azure_region') || 'central india';

      if (!azureKey) {
        setError('Azure API key not configured');
        return null;
      }

      const endpoint =
        sourceLanguage == "Auto-Detect"
          ? `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLanguage}`
          : `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${sourceLanguage}&to=${targetLanguage}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Ocp-Apim-Subscription-Region': azureRegion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ text }]),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result && result[0] && result[0].translations && result[0].translations[0]) {
        return result[0].translations[0].text;
      } else {
        throw new Error('Invalid translation response format');
      }
    } catch (err) {
      console.error('Translation error:', err);
      setError(err instanceof Error ? err.message : 'Translation failed');
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  return {
    translateText,
    isTranslating,
    error,
  };
};
