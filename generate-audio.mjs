import fs from "node:fs/promises";
import path from "node:path";
import { KokoroTTS } from "kokoro-js";
import { Mp3Encoder } from "@breezystack/lamejs";

// "af_sky" is Kokoro's brightest, most energetic voice for kids.
// Other great options: "af_bella" (warm & bubbly), "bf_alice" (bright UK)
const VOICE = "af_sky";
const OUT_DIR = "./audio";

export function audioKey(text) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");
}

function cleanText(text) {
    return text
        .replace(/[^\p{L}\p{N}\s?!.,'-]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Shapes the spoken text for warmer, bouncier toddler prosody without changing the filename key
function makeCheerful(text, kind) {
    if (kind === "cheer") {
        return text.replace(/!/g, "!! ");
    }
    if (kind === "giggle") {
        return text
            .replace("Tee-hee!", "Tee-hee-hee!")
            .replace("Hehe,", "He-he-he!");
    }
    if (kind === "reveal") {
        // Turns "It's a toy car!" into "It's a toy car!!" for an upbeat lift
        return text.replace(/!$/, "!!");
    }
    if (kind === "question") {
        // Adds a subtle upward inflection on yes/no and open questions
        return text.replace(/\?$/, "?!");
    }
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

async function main() {
    const html = await fs.readFile("./index.html", "utf8");

    const extractBlock = (pattern) => {
        const m = html.match(pattern);
        if (!m) throw new Error(`Could not find pattern: ${pattern}`);
        return Function(`"use strict"; return (${m[1]});`)();
    };

    const LIBRARY = extractBlock(/const LIBRARY = (\[[\s\S]*?\]);/);
    const SOME = extractBlock(/const SOME = new Set\((\[[\s\S]*?\])\);/);
    const QUESTIONS = extractBlock(/const QUESTIONS = (\[[\s\S]*?\]);/);
    const CHEERS = extractBlock(/const CHEERS = (\[[\s\S]*?\]);/);
    const GIGGLES = extractBlock(/const GIGGLES = (\[[\s\S]*?\]);/);

    const someSet = new Set(SOME);
    // Map of raw UI string -> { kind, speed }
    const entries = new Map([
        [
            "It's in the bag! Open your eyes. What's in the bag?",
            { kind: "prompt", speed: 1.08 },
        ],
        ["Bleh! Nothing in here!", { kind: "giggle", speed: 1.15 }],
    ]);

    for (const c of CHEERS) entries.set(c, { kind: "cheer", speed: 1.14 });
    for (const g of GIGGLES) entries.set(g, { kind: "giggle", speed: 1.14 });
    for (const q of QUESTIONS)
        entries.set(q.text, { kind: "question", speed: 1.07 });

    for (const row of LIBRARY) {
        const [, name] = row.split("|");
        const art = someSet.has(name)
            ? "some"
            : /^[aeiou]/.test(name)
              ? "an"
              : "a";
        entries.set(`It's ${art} ${name}!`, { kind: "reveal", speed: 1.1 });
    }

    await fs.mkdir(OUT_DIR, { recursive: true });

    console.log(`Loading Kokoro-82M neural TTS model (voice: ${VOICE})...`);
    const tts = await KokoroTTS.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0-ONNX",
        { dtype: "q8", device: "cpu" },
    );

    const files = [];
    let generated = 0;
    const total = entries.size;

    for (const [raw, { kind, speed }] of entries) {
        const clean = cleanText(raw);
        const key = audioKey(clean);
        const filename = `${key}.mp3`;
        const outPath = path.join(OUT_DIR, filename);
        files.push(`./audio/${filename}`);

        try {
            await fs.access(outPath);
            continue;
        } catch {}

        const spoken = makeCheerful(clean, kind);
        const rawAudio = await tts.generate(spoken, {
            voice: VOICE,
            speed,
        });
        const mp3Buf = encodeMp3(rawAudio.audio, rawAudio.sampling_rate);
        await fs.writeFile(outPath, mp3Buf);
        generated++;
        process.stdout.write(
            `\rGenerated ${generated} (${files.length}/${total}): ${filename}          `,
        );
    }

    await fs.writeFile(
        path.join(OUT_DIR, "manifest.json"),
        JSON.stringify(files, null, 2),
    );
    console.log(`\nDone! ${files.length} cheerful MP3 clips saved to ${OUT_DIR}/`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
