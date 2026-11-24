import fs from "node:fs/promises";
import path from "node:path";
import { KokoroTTS } from "kokoro-js";
import { Mp3Encoder } from "@breezystack/lamejs";
import {
    LIBRARY,
    SOME,
    QUESTIONS,
    CHEERS,
    GIGGLES,
    audioKey,
    emojiToCodepoint,
} from "./data.js";

const VOICE = "af_sky";
const AUDIO_DIR = "./audio";
const EMOJI_DIR = "./emoji";
const TWEMOJI_BASE =
    "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

function cleanText(text) {
    return text
        .replace(/[^\p{L}\p{N}\s?!.,'-]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

function makeCheerful(text, kind) {
    if (kind === "cheer") return text.replace(/!/g, "!! ");
    if (kind === "giggle") return text.replace("Hehe,", "He-he-he!");
    if (kind === "reveal") return text.replace(/!$/, "!!");
    if (kind === "question") return text.replace(/\?$/, "?!");
    return text;
}

function floatTo16BitPCM(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
}

function encodeMp3(float32Samples, sampleRate) {
    const pcm = floatTo16BitPCM(float32Samples);
    const encoder = new Mp3Encoder(1, sampleRate, 64);
    const chunks = [];
    const blockSize = 1152;

    for (let i = 0; i < pcm.length; i += blockSize) {
        const chunk = encoder.encodeBuffer(pcm.subarray(i, i + blockSize));
        if (chunk.length > 0) chunks.push(Buffer.from(chunk));
    }
    const end = encoder.flush();
    if (end.length > 0) chunks.push(Buffer.from(end));

    return Buffer.concat(chunks);
}

async function syncEmojis() {
    await fs.mkdir(EMOJI_DIR, { recursive: true });
    const emojiFiles = [];
    let downloaded = 0;

    for (const row of LIBRARY) {
        const [look] = row.split("|");
        if (look.startsWith("svg:")) continue;

        const hex = emojiToCodepoint(look);
        const filename = `${hex}.svg`;
        const outPath = path.join(EMOJI_DIR, filename);
        emojiFiles.push(`./emoji/${filename}`);

        try {
            await fs.access(outPath);
            continue;
        } catch {}

        const res = await fetch(`${TWEMOJI_BASE}/${filename}`);
        if (!res.ok) {
            throw new Error(
                `Failed to fetch ${look} (${filename}): ${res.status}`,
            );
        }
        await fs.writeFile(outPath, await res.text());
        downloaded++;
    }

    await fs.writeFile(
        path.join(EMOJI_DIR, "manifest.json"),
        JSON.stringify(emojiFiles, null, 2),
    );
    console.log(
        `Emojis ready: ${emojiFiles.length} SVGs (${downloaded} newly downloaded).`,
    );
}

async function syncAudio() {
    const entries = new Map([
        ["It's in the bag!", { kind: "prompt", speed: 1.08 }],
        ["Open your eyes.", { kind: "prompt", speed: 0.98 }],
        ["What's in the bag?", { kind: "question", speed: 1.06 }],
        ["Bleh! Nothing in here!", { kind: "giggle", speed: 1.15 }],
    ]);

    for (const c of CHEERS) entries.set(c, { kind: "cheer", speed: 1.14 });
    for (const g of GIGGLES) entries.set(g, { kind: "giggle", speed: 1.14 });
    for (const q of QUESTIONS)
        entries.set(q.text, { kind: "question", speed: 1.07 });

    for (const row of LIBRARY) {
        const [, name, , sound] = row.split("|");
        const art = SOME.has(name)
            ? "some"
            : /^[aeiou]/.test(name)
              ? "an"
              : "a";
        entries.set(`It's ${art} ${name}!`, { kind: "reveal", speed: 1.1 });
        if (sound && sound !== "-") {
            entries.set(sound, { kind: "cheer", speed: 1.08 });
        }
    }

    await fs.mkdir(AUDIO_DIR, { recursive: true });

    const audioFiles = [];
    const missing = [];

    for (const [raw, meta] of entries) {
        const clean = cleanText(raw);
        const key = audioKey(clean);
        const filename = `${key}.mp3`;
        const outPath = path.join(AUDIO_DIR, filename);
        audioFiles.push(`./audio/${filename}`);

        try {
            await fs.access(outPath);
        } catch {
            missing.push({ clean, outPath, filename, ...meta });
        }
    }

    if (missing.length > 0) {
        console.log(
            `Loading Kokoro-82M neural TTS model (voice: ${VOICE}) for ${missing.length} new clips...`,
        );
        const tts = await KokoroTTS.from_pretrained(
            "onnx-community/Kokoro-82M-v1.0-ONNX",
            { dtype: "q8", device: "cpu" },
        );

        for (let i = 0; i < missing.length; i++) {
            const { clean, outPath, filename, kind, speed } = missing[i];
            const spoken = makeCheerful(clean, kind);
            const rawAudio = await tts.generate(spoken, {
                voice: VOICE,
                speed,
            });
            const mp3Buf = encodeMp3(rawAudio.audio, rawAudio.sampling_rate);
            await fs.writeFile(outPath, mp3Buf);
            process.stdout.write(
                `\rGenerated ${i + 1}/${missing.length}: ${filename}          `,
            );
        }
        process.stdout.write("\n");
    }

    await fs.writeFile(
        path.join(AUDIO_DIR, "manifest.json"),
        JSON.stringify(audioFiles, null, 2),
    );
    console.log(
        `Audio ready: ${audioFiles.length} MP3 clips (${missing.length} newly generated).`,
    );
}

await syncEmojis();
await syncAudio();
