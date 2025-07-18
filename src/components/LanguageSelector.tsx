import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  allowAutoDetect?: boolean; // New prop
}

const LANGUAGES = [
  // Removed 'auto' from here as it will be conditionally added
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "no", name: "Norwegian" },
  { code: "fi", name: "Finnish" },
  { code: "cs", name: "Czech" },
  { code: "hu", name: "Hungarian" },
  { code: "ro", name: "Romanian" },
  { code: "uk", name: "Ukrainian" },
  { code: "bg", name: "Bulgarian" },
  { code: "hr", name: "Croatian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "et", name: "Estonian" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
];

const LanguageSelector = ({
  value,
  onChange,
  label,
  allowAutoDetect,
}: LanguageSelectorProps) => {
  const selectedLanguage = LANGUAGES.find((lang) => lang.code === value);

  // Create a new array including 'Auto-Detect' if allowed
  const displayLanguages = allowAutoDetect
    ? [{ code: "Auto-Detect", name: "Auto-Detect" }, ...LANGUAGES]
    : LANGUAGES;

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-slate-600">{label}:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue>
            {value === "Auto-Detect" && allowAutoDetect
              ? "Auto-Detect"
              : selectedLanguage
              ? selectedLanguage.name
              : "Select Language"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {displayLanguages.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              {language.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
