
import { VideoAccent, ProductData, BulkVoiceOver, ProductNiche } from "../types";
import { auth } from "./firebase";

/**
 * All calls are now proxied through Netlify Functions to ensure 
 * the user's API key is never exposed to the frontend.
 */

async function callProxy(functionName: string, payload: any) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const idToken = await user.getIdToken();

  const response = await fetch(`/.netlify/functions/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Server error");
  }

  return response.json();
}

export const detectNiche = async (product: Partial<ProductData>): Promise<ProductNiche> => {
  const res = await callProxy('detect-niche', { product });
  return res.niche;
};

export const generateBulkScripts = async (product: ProductData): Promise<BulkVoiceOver[]> => {
  return callProxy('generate-scripts', { product });
};

export const regenerateSingleScript = async (product: ProductData, angle: string): Promise<string> => {
  const res = await callProxy('regenerate-script', { product, angle });
  return res.script;
};

export const generateAudio = async (text: string, accent: VideoAccent, voice: string): Promise<string> => {
  const res = await callProxy('generate-audio', { text, accent, voice });
  return res.audioBase64;
};

export const generateVisualsForScript = async (productTitle: string, script: string, referenceImageBase64: string, insideImageBase64?: string, niche?: ProductNiche, accent?: VideoAccent): Promise<{ images: string[], viewTypes: ('outside' | 'inside')[] }> => {
  return callProxy('generate-visuals', { productTitle, script, referenceImageBase64, insideImageBase64, niche, accent });
};

export const regenerateSingleImage = async (productTitle: string, script: string, index: number, refImg: string, instr?: string, instrImg?: string, accent?: VideoAccent): Promise<string> => {
  const res = await callProxy('regenerate-image', { productTitle, script, index, refImg, instr, instrImg, accent });
  return res.image;
};

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export function createAudioDownloadUrl(base64: string): string {
  const bytes = decode(base64);
  const wavHeader = createWavHeader(bytes.length);
  const wavBytes = new Uint8Array(wavHeader.length + bytes.length);
  wavBytes.set(wavHeader);
  wavBytes.set(bytes, wavHeader.length);
  return URL.createObjectURL(new Blob([wavBytes], { type: 'audio/wav' }));
}

function createWavHeader(dataLength: number): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const writeString = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, 24000 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  return new Uint8Array(buffer);
}
