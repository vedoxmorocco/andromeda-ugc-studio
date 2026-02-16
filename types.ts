
export enum VideoAccent {
  // Arabic Accents
  MOROCCAN_DARIJA = 'Moroccan Darija',
  SAUDI = 'Saudi (Najdi/Hejazi)',
  EGYPTIAN = 'Egyptian',
  LEBANESE = 'Lebanese',
  EMIRATI = 'Emirati',
  ALGERIAN = 'Algerian',
  TUNISIAN = 'Tunisian',
  // LATAM Accents
  MEXICAN = 'Mexican Spanish',
  PERUVIAN = 'Peruvian Spanish',
  PANAMANIAN = 'Panamanian Spanish',
  COLOMBIAN = 'Colombian Spanish',
  ARGENTINIAN = 'Argentinian Spanish',
  CHILEAN = 'Chilean Spanish'
}

export enum VoiceGender {
  MALE = 'Male',
  FEMALE = 'Female'
}

export enum VoiceName {
  ZEPHYR = 'Zephyr',
  PUCK = 'Puck',
  KORE = 'Kore',
  FENRIR = 'Fenrir',
  CHARON = 'Charon',
  DESPINA = 'Despina',
  AUTONOE = 'AutonOE',
  AOEDE = 'Aoede',
  LEDA = 'Leda'
}

export enum CaptionStyle {
  CLEAN_MINIMAL = 'Clean Minimal',
  TIKTOK_NATIVE = 'TikTok Native',
  EMOTIONAL_COD = 'Emotional COD',
  STORYTELLING = 'Storytelling',
  AGGRESSIVE_HOOK = 'Aggressive Hook'
}

export enum CaptionPosition {
  TOP = 'Top',
  CENTER = 'Center',
  BOTTOM = 'Bottom'
}

export enum TransitionType {
  NONE = 'None',
  HARD_CUT = 'Hard Cut',
  FADE = 'Fade',
  SLIDE = 'Slide',
  ZOOM = 'Zoom',
  MOTION_BLUR = 'Motion Blur'
}

export interface CaptionSettings {
  style: CaptionStyle;
  position: CaptionPosition;
  size: number;
  textColor: string;
  backgroundColor: string;
  showCaptions: boolean;
}

export enum ProductNiche {
  AUTO = 'Auto-detect',
  FASHION = 'Fashion',
  COSMETICS = 'Cosmetics',
  GADGETS = 'Gadgets',
  GIFT = 'Gift'
}

export enum GenerationMode {
  ALL_ANGLES = 'All Angles',
  SPECIFIC_ANGLE = 'Specific Angle'
}

export const STANDARD_ANGLES = [
  "Holiday",
  "Hook",
  "Pain Point",
  "Social Proof",
  "Top Feature",
  "Lifestyle",
  "Call to Action"
];

export interface ProductData {
  title: string;
  description: string;
  image: string; // base64 (Main/Outside)
  insideImage?: string; // base64 (Interior/Detail)
  accent: VideoAccent;
  gender: VoiceGender;
  voice: VoiceName;
  niche: ProductNiche;
  mode: GenerationMode;
  targetAngle?: string;
  variantCount: number;
  recipient?: string;
  occasion?: string;
  holiday?: string;
}

export interface BulkVoiceOver {
  angle: string;
  script: string;
  audioBase64?: string;
  images?: string[]; // active base64 sequence
  videos?: (string | null)[]; // array of video data URLs for per-scene overrides
  videoDurations?: (number | null)[]; 
  useVideoAudio?: boolean[]; 
  sceneHistory?: { [key: number]: string[] };
  sceneViewTypes?: ('outside' | 'inside')[]; 
  transitionType?: TransitionType;
  captionSettings?: CaptionSettings;
}

export type GenerationStatus = 'idle' | 'generating_bulk' | 'generating_visuals' | 'regenerating_image' | 'exporting' | 'complete' | 'error';
