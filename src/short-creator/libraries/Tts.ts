// Gemeinsame Form der Sprechmaschinen (Kokoro, Piper).
export interface Tts {
  generate(
    text: string,
    voice: string,
  ): Promise<{ audio: ArrayBuffer; audioLength: number }>;
  listAvailableVoices(): string[];
}
