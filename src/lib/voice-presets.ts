export interface VoicePreset {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  frequency: string;
  promptFragment: string;
}

export const VOICE_GENDERS = [
  { id: 'female' as const, name: '女声' },
  { id: 'male' as const, name: '男声' },
];

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'warm_female',
    name: '温柔女声',
    gender: 'female',
    description: '温柔知性，25-30岁女性',
    frequency: '200-340Hz',
    promptFragment: 'A woman in her late 20s with a warm, gentle voice, speaking softly at a calm measured pace, mid-frequency range with slight breathiness, warm and nurturing tone',
  },
  {
    id: 'professional_female',
    name: '专业女声',
    gender: 'female',
    description: '干练自信，30-35岁女性',
    frequency: '220-380Hz',
    promptFragment: 'A woman in her early 30s with a clear, confident voice, speaking articulately at a steady professional pace, mid-to-high frequency range, crisp enunciation, authoritative yet approachable tone',
  },
  {
    id: 'young_female',
    name: '活力女声',
    gender: 'female',
    description: '青春活力，20-25岁女性',
    frequency: '260-440Hz',
    promptFragment: 'A young woman in her early 20s with a bright, energetic voice, speaking at a brisk enthusiastic pace, higher frequency range, bubbly and animated tone with natural inflection',
  },
  {
    id: 'mature_female',
    name: '知性女声',
    gender: 'female',
    description: '优雅沉稳，35-45岁女性',
    frequency: '180-300Hz',
    promptFragment: 'A woman in her 40s with a rich, resonant voice, speaking at a thoughtful deliberate pace, lower-mid frequency range with warm depth, elegant and composed tone conveying wisdom and experience',
  },
  {
    id: 'deep_male',
    name: '沉稳男声',
    gender: 'male',
    description: '低沉有力，30-40岁男性',
    frequency: '85-180Hz',
    promptFragment: 'A man in his 30s with a deep, resonant voice, speaking at a measured authoritative pace, low frequency range with chest resonance, steady and commanding tone that conveys confidence and reliability',
  },
  {
    id: 'warm_male',
    name: '温暖男声',
    gender: 'male',
    description: '温和亲切，25-35岁男性',
    frequency: '110-220Hz',
    promptFragment: 'A man in his late 20s with a warm, friendly voice, speaking at a relaxed conversational pace, mid-frequency range with natural warmth, approachable and genuine tone like talking to a close friend',
  },
  {
    id: 'young_male',
    name: '活力男声',
    gender: 'male',
    description: '阳光活力，20-25岁男性',
    frequency: '130-260Hz',
    promptFragment: 'A young man in his early 20s with a bright, energetic voice, speaking at a fast enthusiastic pace, mid-to-high frequency range, lively and animated tone with natural excitement and vigor',
  },
  {
    id: 'elderly_male',
    name: '沧桑男声',
    gender: 'male',
    description: '深沉沧桑，50-60岁男性',
    frequency: '75-160Hz',
    promptFragment: 'An older man in his 50s with a weathered, gravelly voice, speaking at a slow deliberate pace, low frequency range with slight raspiness, weighty and reflective tone carrying the gravity of lived experience',
  },
];

const EMOTION_MAP: Record<string, string> = {
  warm_female: 'warmly',
  professional_female: 'confidently',
  young_female: 'enthusiastically',
  mature_female: 'thoughtfully',
  deep_male: 'authoritatively',
  warm_male: 'friendlily',
  young_male: 'excitedly',
  elderly_male: 'reflectively',
};

export function getVoicePreset(id: string): VoicePreset | undefined {
  return VOICE_PRESETS.find(v => v.id === id);
}

export function getEmotionFromStyle(presetId: string): string {
  return EMOTION_MAP[presetId] || 'calmly';
}

export function buildAudioPrompt(
  speechText: string,
  voicePresetId: string,
  audioPrompt?: string,
  backgroundMusic?: string,
): string {
  const preset = getVoicePreset(voicePresetId);
  if (!preset || !speechText) return '';

  const emotion = getEmotionFromStyle(voicePresetId);
  const parts: string[] = [];

  parts.push(`${preset.promptFragment} says ${emotion}, "${speechText}"`);

  if (audioPrompt) {
    parts.push(audioPrompt);
  }

  if (backgroundMusic) {
    parts.push(`Music: ${backgroundMusic}`);
  }

  return parts.join('. ');
}
