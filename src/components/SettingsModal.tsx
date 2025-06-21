
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [gladiaKey, setGladiaKey] = useState('');
  const [azureKey, setAzureKey] = useState('');
  const [azureRegion, setAzureRegion] = useState('');
  const [elevenlabsKey, setElevenlabsKey] = useState('');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmKey, setLlmKey] = useState('');
  const [showKeys, setShowKeys] = useState({
    gladia: false,
    azure: false,
    elevenlabs: false,
    llm: false,
  });

  useEffect(() => {
    if (isOpen) {
      // Load saved API keys
      setGladiaKey(localStorage.getItem('gladia_api_key') || '');
      setAzureKey(localStorage.getItem('azure_api_key') || '');
      setAzureRegion(localStorage.getItem('azure_region') || 'eastus');
      setElevenlabsKey(localStorage.getItem('elevenlabs_api_key') || '');
      setLlmProvider(localStorage.getItem('llm_provider') || 'openai');
      setLlmKey(localStorage.getItem('llm_api_key') || '');
    }
  }, [isOpen]);

  const handleSave = () => {
    // Save API keys to localStorage
    localStorage.setItem('gladia_api_key', gladiaKey);
    localStorage.setItem('azure_api_key', azureKey);
    localStorage.setItem('azure_region', azureRegion);
    localStorage.setItem('elevenlabs_api_key', elevenlabsKey);
    localStorage.setItem('llm_provider', llmProvider);
    localStorage.setItem('llm_api_key', llmKey);
    
    onClose();
  };

  const toggleKeyVisibility = (key: keyof typeof showKeys) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderKeyInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    keyType: keyof typeof showKeys,
    placeholder: string,
    description?: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={keyType} className="text-sm font-medium">
        {label}
      </Label>
      {description && (
        <p className="text-xs text-slate-600">{description}</p>
      )}
      <div className="relative">
        <Input
          id={keyType}
          type={showKeys[keyType] ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-8 w-8 p-0"
          onClick={() => toggleKeyVisibility(keyType)}
        >
          {showKeys[keyType] ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>API Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Gladia API */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Gladia API (Speech-to-Text)
            </h3>
            {renderKeyInput(
              'API Key',
              gladiaKey,
              setGladiaKey,
              'gladia',
              'Enter your Gladia API key',
              'Used for real-time speech transcription. Get your key from https://gladia.io'
            )}
          </Card>

          <Separator />

          {/* Azure Translation API */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Azure Translator (Text Translation)
            </h3>
            <div className="space-y-4">
              {renderKeyInput(
                'API Key',
                azureKey,
                setAzureKey,
                'azure',
                'Enter your Azure Translator API key',
                'Used for text translation between languages. Get your key from Azure Portal.'
              )}
              <div className="space-y-2">
                <Label htmlFor="azure-region" className="text-sm font-medium">
                  Azure Region
                </Label>
                <Input
                  id="azure-region"
                  value={azureRegion}
                  onChange={(e) => setAzureRegion(e.target.value)}
                  placeholder="e.g., eastus, westus2"
                />
              </div>
            </div>
          </Card>

          <Separator />

          {/* ElevenLabs API */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              ElevenLabs (Text-to-Speech)
            </h3>
            {renderKeyInput(
              'API Key',
              elevenlabsKey,
              setElevenlabsKey,
              'elevenlabs',
              'Enter your ElevenLabs API key',
              'Used for converting translated text to speech. Get your key from https://elevenlabs.io'
            )}
          </Card>

          <Separator />

          {/* LLM API */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              LLM API (Optional - Future Features)
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="llm-provider" className="text-sm font-medium">
                  LLM Provider
                </Label>
                <Select value={llmProvider} onValueChange={setLlmProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="azure">Azure OpenAI</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="aws">AWS Bedrock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderKeyInput(
                'API Key',
                llmKey,
                setLlmKey,
                'llm',
                `Enter your ${llmProvider} API key`,
                'Optional: For advanced features like context understanding and summarization.'
              )}
            </div>
          </Card>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
