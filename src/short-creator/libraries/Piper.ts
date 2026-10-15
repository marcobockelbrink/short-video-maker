import { spawn } from "child_process";
import fs from "fs-extra";
import path from "path";
import cuid from "cuid";

import { Config, logger } from "../../config";
import type { Tts } from "./Tts";

// Abwandlung: Piper (lokal, offline) als zweite Sprechmaschine, damit
// deutsche Texte deutsch klingen. Gewählt über TTS_ENGINE=piper.
export class Piper implements Tts {
  constructor(
    private binary: string,
    private model: string,
    private tempDir: string,
  ) {}

  static async init(config: Config): Promise<Piper> {
    const binary = process.env.PIPER_BIN ?? "/opt/piper/piper";
    const model =
      process.env.PIPER_MODEL ?? "/opt/piper/voices/de_DE-thorsten-medium.onnx";
    for (const datei of [binary, model, `${model}.json`]) {
      if (!(await fs.pathExists(datei))) {
        throw new Error(`Piper: Datei fehlt: ${datei}`);
      }
    }
    return new Piper(binary, model, config.tempDirPath);
  }

  async generate(
    text: string,
    // Die Stimme steckt im Modell; der Wert aus der Anfrage (Kokoro-Name) zählt nicht.
    _voice?: string,
  ): Promise<{ audio: ArrayBuffer; audioLength: number }> {
    const ausgabe = path.join(this.tempDir, `${cuid()}-piper.wav`);
    try {
      await new Promise<void>((resolve, reject) => {
        const kind = spawn(
          this.binary,
          ["--model", this.model, "--output_file", ausgabe, "--quiet"],
          { stdio: ["pipe", "ignore", "pipe"] },
        );
        let fehler = "";
        kind.stderr.on("data", (d) => (fehler += d.toString()));
        kind.on("error", reject);
        kind.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(
                new Error(`Piper endete mit ${code}: ${fehler.slice(-300)}`),
              ),
        );
        kind.stdin.end(text.replace(/\s+/g, " ").trim() + "\n");
      });

      const wav = await fs.readFile(ausgabe);
      // Standard-WAV-Kopf (44 Bytes): Bytes/Sekunde bei 28, Datenlänge bei 40.
      const bytesProSekunde = wav.readUInt32LE(28);
      const datenLaenge = wav.readUInt32LE(40);
      const audioLength = datenLaenge / bytesProSekunde;
      logger.debug({ text, audioLength }, "Audio generated with Piper");

      const audio = wav.buffer.slice(
        wav.byteOffset,
        wav.byteOffset + wav.byteLength,
      ) as ArrayBuffer;
      return { audio, audioLength };
    } finally {
      await fs.remove(ausgabe);
    }
  }

  listAvailableVoices(): string[] {
    return [path.basename(this.model, ".onnx")];
  }
}
