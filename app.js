import {
    FRIDGE_SVG,
    LIBRARY,
    SOME,
    QUESTIONS,
    CHEERS,
    GIGGLES,
    COLORS,
    audioKey,
    emojiToCodepoint,
} from "./data.js";

const ITEMS = LIBRARY.map((row, i) => {
    const [look, name, colors, sound, tags] = row.split("|");
    const art = SOME.has(name)
        ? "some"
        : /^[aeiou]/.test(name)
          ? "an"
          : "a";
    return {
        id: i,
        look,
        name,
        phrase: `${art} ${name}`,
        colors: colors.split(","),
        sound: sound === "-" ? null : sound,
        tags: new Set(tags.split(" ")),
    };
});

const render = (item) => {
    if (item.look === "svg:fridge") return FRIDGE_SVG;
    const hex = emojiToCodepoint(item.look);
    return `<img src="./emoji/${hex}.svg" alt="${item.name}" draggable="false" onerror="this.replaceWith(document.createTextNode('${item.look}'))">`;
};

/* ===================== question ranking & answers ===================== */
function questionPasses(q, item) {
    if (q.key === "color") return true;
    if (q.key === "sound") return !!item.sound;
    return item.tags.has(q.key);
}

/* Ranks remaining questions by weight + information gain against surviving candidates */
function buildQuestionQueue(item, candidatePool = ITEMS) {
    return QUESTIONS.map((q) => {
        const yes = questionPasses(q, item);
        let yesCount = 0;
        for (const c of candidatePool) {
            if (questionPasses(q, c)) yesCount++;
        }
        const ratio = candidatePool.length
            ? yesCount / candidatePool.length
            : 0.5;
        // Highest bonus when a question splits remaining candidates near 50/50
        const infoGain = 1 - Math.abs(ratio - 0.5) * 2;
        return {
            q,
            score:
                q.weight +
                infoGain * 1.4 +
                (yes ? 0.5 : 0) +
                Math.random() * 1.1,
        };
    })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.q);
}

function answerFor(q, item) {
    if (q.key === "color") {
        const words = item.colors
            .map((c) => c[0].toUpperCase() + c.slice(1))
            .join(" and ");
        return {
            cls: "info",
            html:
                item.colors
                    .map(
                        (c) =>
                            `<span class="swatch" style="background:${COLORS[c] || "#ccc"}"></span>`,
                    )
                    .join("") + `<span>${words}</span>`,
        };
    }
    if (q.key === "sound") {
        return item.sound
            ? { cls: "info", html: `<span>🔊 ${item.sound}</span>` }
            : { cls: "info", html: "<span>🤫 It’s quiet</span>" };
    }
    return item.tags.has(q.key)
        ? { cls: "yes", html: "<span>👍 Yes!</span>" }
        : { cls: "no", html: "<span>👎 No</span>" };
}

function pruneQueue(q, item) {
    const drop = new Set();
    if (q.key === "noise" && !item.tags.has("noise")) drop.add("sound");
    if (q.key === "sound") drop.add("noise");
    if (q.key === "alive" && !item.tags.has("alive")) drop.add("feathers");
    if (q.key === "eat" && !item.tags.has("eat")) {
        drop.add("fruit");
        drop.add("sweet");
    }
    if (q.key === "big" && item.tags.has("big")) drop.add("small");
    if (q.key === "small" && item.tags.has("small")) drop.add("big");
    if (drop.size) queue = queue.filter((next) => !drop.has(next.key));
}

/* ===================== settings, theme & sound ===================== */
const VISIBLE_QUESTIONS = 5;
const ITEMS_ON_SCREEN = 8;

let soundOn = true,
    helperOn = true,
    themePref = "auto";
try {
    soundOn = localStorage.getItem("bag-sound") !== "off";
    helperOn = localStorage.getItem("bag-helper") !== "off";
    themePref = localStorage.getItem("bag-theme") || "auto";
} catch (e) {}

let audioCtx;
function blip(kind) {
    if (!soundOn) return;
    try {
        audioCtx =
            audioCtx ||
            new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
        const now = audioCtx.currentTime;
        if (kind === "win") {
            const fanfare = [
                { f: 523.25, t: 0.0, d: 0.13, g: 0.2 },
                { f: 659.25, t: 0.09, d: 0.13, g: 0.2 },
                { f: 783.99, t: 0.18, d: 0.13, g: 0.22 },
                { f: 1046.5, t: 0.28, d: 0.42, g: 0.25 },
                { f: 659.25, t: 0.28, d: 0.42, g: 0.14 },
            ];
            fanfare.forEach(({ f, t, d, g }) => {
                const o = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                o.type = "triangle";
                o.frequency.setValueAtTime(f, now + t);
                gain.gain.setValueAtTime(0.0001, now + t);
                gain.gain.exponentialRampToValueAtTime(g, now + t + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
                o.connect(gain).connect(audioCtx.destination);
                o.start(now + t);
                o.stop(now + t + d + 0.03);
            });
            return;
        }
        const notes =
            kind === "gulp"
                ? [420, 180]
                : kind === "giggle"
                  ? [520, 660, 580, 780]
                  : kind === "bleh"
                    ? [460, 350, 240]
                    : [660];
        notes.forEach((f, i) => {
            const o = audioCtx.createOscillator(),
                g = audioCtx.createGain();
            o.type =
                kind === "gulp" || kind === "bleh" ? "sine" : "triangle";
            const t = now + i * 0.09;
            o.frequency.setValueAtTime(f, t);
            if (kind === "gulp")
                o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.12);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            o.connect(g).connect(audioCtx.destination);
            o.start(t);
            o.stop(t + 0.25);
        });
    } catch (e) {}
}

function speakFallback(lines, excited = false, rate = 1.0) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lines.join(" "));
    u.rate = rate * (excited ? 1.08 : 1.02);
    u.pitch = 1.0;
    speechSynthesis.speak(u);
}

const audioCache = new Map();
function getClip(key) {
    if (!audioCache.has(key)) {
        const a = new Audio(`./audio/${key}.mp3`);
        a.preload = "auto";
        audioCache.set(key, a);
    }
    return audioCache.get(key);
}

let activeVoiceAudio = null;
let voiceSeq = 0;

function stopVoice() {
    voiceSeq++;
    if (activeVoiceAudio) {
        activeVoiceAudio.pause();
        activeVoiceAudio.currentTime = 0;
        activeVoiceAudio = null;
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function say(input, excited = false, rate = 1.0, gapMs = 65) {
    if (!soundOn) return;
    const lines = (Array.isArray(input) ? input : [input])
        .map((t) =>
            t
                .replace(/[^\p{L}\p{N}\s?!.,'-]/gu, "")
                .replace(/\s+/g, " ")
                .trim(),
        )
        .filter(Boolean);
    if (!lines.length) return;

    stopVoice();
    const seq = voiceSeq;
    const clips = lines.map((line) => getClip(audioKey(line)));

    const playAt = (idx) => {
        if (!soundOn || seq !== voiceSeq || idx >= clips.length) return;
        const audio = clips[idx];
        audio.currentTime = 0;
        audio.playbackRate = rate;
        activeVoiceAudio = audio;
        audio.addEventListener(
            "ended",
            () => {
                if (idx + 1 < clips.length) {
                    setTimeout(() => playAt(idx + 1), gapMs);
                }
            },
            { once: true },
        );
        audio.play().catch(() => {
            if (seq === voiceSeq)
                speakFallback(lines.slice(idx), excited, rate);
        });
    };

    playAt(0);
}

/* Preload the opening transition clips immediately so first round has zero latency */
["its-in-the-bag", "open-your-eyes", "whats-in-the-bag"].forEach(getClip);

/* ===================== elements & state ===================== */
const $ = (id) => document.getElementById(id);
const stage = $("stage"),
    bag = $("bag"),
    bagThing = $("bagThing"),
    pupils = $("pupils"),
    smileEl = $("smile");
const questionsEl = $("questions"),
    starsEl = $("stars");
const promptBig = $("promptBig"),
    promptSmall = $("promptSmall");
const libraryModal = $("libraryModal"),
    libGrid = $("libGrid"),
    libSearch = $("libSearch"),
    libCats = $("libCats");
const guessedBtn = $("guessedBtn");

let phase = "hide";
let shown = [];
let hidden = null;
let queue = [];
let candidates = [];
let asked = 0;
let activeCat = "all";
const recentIds = new Set();

function setPhase(p) {
    phase = p;
    document.body.dataset.phase = p;
    bag.setAttribute(
        "aria-label",
        p === "ask"
            ? "The bag. Press and hold to peek inside."
            : "The bag. Tap to boop or drag something inside.",
    );
    requestAnimationFrame(layout);
}
function setPrompt(big, small) {
    promptBig.textContent = big;
    promptSmall.textContent = small;
}

/* ===================== layout ===================== */
function layout() {
    const w = stage.clientWidth,
        h = stage.clientHeight;
    if (!w || !h) return;
    const m = Math.min(w, h);
    const item = Math.round(Math.max(58, Math.min(92, m * 0.2)));
    stage.style.setProperty("--item", item + "px");
    const bagW =
        phase === "hide"
            ? Math.min(w * 0.4, h * 0.36, 220)
            : Math.min(w * 0.48, h * 0.88, 220);
    bag.style.setProperty("--bag-w", Math.max(90, bagW) + "px");
    document.documentElement.style.setProperty(
        "--bag-w",
        Math.max(90, bagW) + "px",
    );

    const rx = w / 2 - item / 2 - 4,
        ry = h / 2 - item / 2 - 8;
    stage.querySelectorAll(".item").forEach((el) => {
        if (el.classList.contains("dragging")) return;
        const k = +el.dataset.slot,
            n = ITEMS_ON_SCREEN;
        const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
        el.style.setProperty("--x", w / 2 + Math.cos(a) * rx + "px");
        el.style.setProperty("--y", h / 2 + Math.sin(a) * ry + "px");
    });
}
new ResizeObserver(layout).observe(stage);
window.addEventListener("orientationchange", () => {
    setTimeout(layout, 80);
    setTimeout(layout, 300);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", layout);
}

/* ===================== library picker ===================== */
function matchesCategory(item, cat) {
    if (cat === "all") return true;
    if (cat === "animals") return item.tags.has("alive");
    if (cat === "food") return item.tags.has("eat");
    if (cat === "vehicles")
        return item.tags.has("wheels") || item.tags.has("ride");
    if (cat === "home")
        return (
            item.tags.has("home") &&
            !item.tags.has("alive") &&
            !item.tags.has("eat")
        );
    if (cat === "outside") return item.tags.has("outside");
    return true;
}

function renderLibrary() {
    const term = libSearch.value.trim().toLowerCase();
    const filtered = ITEMS.filter((it) => {
        if (!matchesCategory(it, activeCat)) return false;
        if (!term) return true;
        return (
            it.name.includes(term) ||
            it.colors.some((c) => c.includes(term)) ||
            it.tags.has(term)
        );
    });

    if (!filtered.length) {
        libGrid.innerHTML =
            '<div class="lib-empty">Nothing matched that search</div>';
        return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach((it) => {
        const btn = document.createElement("button");
        btn.className = "lib-card";
        btn.type = "button";
        btn.setAttribute("aria-label", `Hide ${it.phrase}`);
        btn.innerHTML = `<span class="lib-ic" aria-hidden="true">${render(it)}</span><span class="lib-name">${it.name}</span>`;
        btn.addEventListener("click", () => {
            closeLibrary();
            pickFromLibrary(it);
        });
        frag.appendChild(btn);
    });
    libGrid.innerHTML = "";
    libGrid.appendChild(frag);
}

function openLibrary() {
    if (phase !== "hide") return;
    blip("pop");
    libSearch.value = "";
    activeCat = "all";
    libCats.querySelectorAll(".lib-cat").forEach((b) => {
        const on = b.dataset.cat === "all";
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on);
    });
    renderLibrary();
    libGrid.scrollTop = 0;
    libraryModal.classList.add("open");
    $("closeLibBtn").focus({ preventScroll: true });
}

function closeLibrary() {
    libraryModal.classList.remove("open");
}

function pickFromLibrary(item) {
    if (phase !== "hide") return;
    let el = stage.querySelector(`.item[data-id="${item.id}"]`);
    if (!el) {
        el = document.createElement("button");
        el.className = "item";
        el.dataset.id = item.id;
        el.innerHTML = render(item);
        el.style.setProperty("--x", stage.clientWidth / 2 + "px");
        el.style.setProperty("--y", stage.clientHeight * 0.16 + "px");
        stage.appendChild(el);
        el.getBoundingClientRect();
    }
    hide(item, el);
}

$("libraryBtn").addEventListener("click", openLibrary);
$("closeLibBtn").addEventListener("click", closeLibrary);
libraryModal.addEventListener("click", (e) => {
    if (e.target === libraryModal) closeLibrary();
});
libSearch.addEventListener("input", renderLibrary);
libCats.addEventListener("click", (e) => {
    const btn = e.target.closest(".lib-cat");
    if (!btn) return;
    activeCat = btn.dataset.cat;
    libCats.querySelectorAll(".lib-cat").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on);
    });
    libGrid.scrollTop = 0;
    renderLibrary();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && libraryModal.classList.contains("open"))
        closeLibrary();
});

/* ===================== round flow ===================== */
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function dealItems() {
    stage.querySelectorAll(".item").forEach((el) => el.remove());
    if (recentIds.size > ITEMS.length - ITEMS_ON_SCREEN * 2) {
        recentIds.clear();
    }
    const fresh = ITEMS.filter((it) => !recentIds.has(it.id));
    const pool = fresh.length >= ITEMS_ON_SCREEN ? fresh : ITEMS;
    shown = shuffle(pool).slice(0, ITEMS_ON_SCREEN);
    shown.forEach((it, k) => {
        recentIds.add(it.id);
        const el = document.createElement("button");
        el.className = "item enter";
        el.dataset.slot = k;
        el.dataset.id = it.id;
        el.innerHTML = render(it);
        el.setAttribute("aria-label", `Put ${it.phrase} in the bag`);
        stage.appendChild(el);
        bindDrag(el, it);
    });
    layout();
    stage
        .querySelectorAll(".item")
        .forEach((el, k) =>
            setTimeout(() => el.classList.remove("enter"), 40 + k * 45),
        );
}

function newRound() {
    stopVoice();
    cancelGuessHold();
    closeLibrary();
    boopTimes = [];
    setPhase("hide");
    resetBagFace();
    hidden = null;
    asked = 0;
    queue = [];
    candidates = [];
    bagThing.innerHTML = "";
    questionsEl.innerHTML = "";
    starsEl.innerHTML = "";
    bag.classList.remove("peeking");
    bag.classList.add("open", "hungry");
    $("libraryBtn").hidden = false;
    $("confetti").innerHTML = "";
    setPrompt(
        "🙈 Guesser, close your eyes!",
        "Drag something into the bag",
    );
    dealItems();
}

function hide(item, el) {
    if (phase !== "hide") return;
    resetBagFace();
    closeLibrary();
    hidden = item;
    candidates = ITEMS.slice();
    bagThing.innerHTML = render(item);
    getClip(audioKey(`It's ${item.phrase}!`));

    // the chosen thing dives into the mouth of the bag
    const sr = stage.getBoundingClientRect(),
        br = bag.getBoundingClientRect();
    el.style.setProperty("--x", br.left + br.width / 2 - sr.left + "px");
    el.style.setProperty("--y", br.top + br.height * 0.35 - sr.top + "px");
    el.classList.remove("dragging");
    el.style.transform = "";
    el.classList.add("poof");

    // everything else disappears
    stage.querySelectorAll(".item").forEach((o, k) => {
        if (o !== el) setTimeout(() => o.classList.add("poof"), 60 + k * 35);
        o.disabled = true;
    });
    setTimeout(
        () => stage.querySelectorAll(".item").forEach((o) => o.remove()),
        700,
    );

    bag.classList.remove("hungry");
    bag.classList.add("gulp");
    blip("gulp");
    setTimeout(() => {
        bag.classList.remove("open", "gulp");
    }, 380);

    setTimeout(() => {
        setPhase("ask");
        $("libraryBtn").hidden = true;
        setPrompt(
            "What’s in the bag? 🤔",
            helperOn
                ? "Tap a question, then tap again to peek"
                : "Tap a question to ask it",
        );
        queue = buildQuestionQueue(item, candidates);
        for (let i = 0; i < VISIBLE_QUESTIONS; i++) addQuestion();
        layout();
        say(
            ["It's in the bag!", "Open your eyes.", "What's in the bag?"],
            false,
            1.0,
            65,
        );
    }, 480);
}

function addQuestion(beforeEl) {
    const q = queue.shift();
    if (!q) {
        if (
            !questionsEl.querySelector(".q") &&
            !questionsEl.querySelector(".done-note")
        ) {
            questionsEl.innerHTML =
                '<div class="done-note">No more questions. Make a guess!</div>';
        }
        return;
    }
    const card = document.createElement("div");
    card.className = "q new";
    const a = answerFor(q, hidden);
    card.innerHTML = `
    <button class="q-btn" type="button"><span class="ic" aria-hidden="true">${q.ic}</span><span class="q-label">${q.text}</span></button>
    <button class="repeat-btn" type="button" aria-label="Repeat question">🔊</button>
    <div class="answer ${a.cls}" role="button" tabindex="0" aria-live="polite" aria-label="Answer shown. Tap for next question.">${a.html}<span class="next-pill">Next ➔</span></div>`;

    const btn = card.querySelector(".q-btn"),
        icEl = card.querySelector(".ic"),
        labelEl = card.querySelector(".q-label"),
        repeatBtn = card.querySelector(".repeat-btn"),
        ansOverlay = card.querySelector(".answer");

    const replace = () => {
        if (card.classList.contains("gone")) return;
        card.classList.add("gone");
        setTimeout(() => {
            addQuestion(card);
            card.remove();
        }, 340);
    };
    card._replace = replace;

    repeatBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        say(q.text);
    });

    btn.addEventListener("click", () => {
        // Step 1: Unasked -> Ask question aloud & flip card to Hider Peek prompt
        if (!card.classList.contains("asked")) {
            say(q.text);
            blip("pop");
            asked++;
            const actualPass = questionPasses(q, hidden);
            candidates = candidates.filter(
                (c) => questionPasses(q, c) === actualPass,
            );
            pruneQueue(q, hidden);
            // Re-rank remaining unshown questions using updated candidate pool
            const remainingKeys = new Set(queue.map((itemQ) => itemQ.key));
            queue = buildQuestionQueue(hidden, candidates).filter((itemQ) =>
                remainingKeys.has(itemQ.key),
            );

            const s = document.createElement("span");
            s.textContent = "⭐";
            starsEl.appendChild(s);
            card.classList.add("asked");
            if (helperOn) {
                icEl.textContent = "🤫";
                labelEl.textContent = "Tap to peek answer";
            } else {
                setTimeout(replace, 450);
            }
            return;
        }
        // Step 2: Asked -> Reveal full-card answer for Hider
        if (helperOn && !card.classList.contains("revealed")) {
            blip("pop");
            card.classList.add("revealed");
        }
    });

    // Step 3: Revealed -> Tap anywhere on the answer banner to dismiss & load next question
    ansOverlay.addEventListener("click", () => {
        blip("pop");
        replace();
    });
    ansOverlay.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            replace();
        }
    });

    questionsEl.insertBefore(card, beforeEl || null);
}

function reveal() {
    if (phase !== "ask") return;
    cancelGuessHold();
    setPhase("reveal");
    bag.classList.add("open", "peeking");
    $("revealThing").innerHTML = render(hidden);
    $("revealTitle").textContent = `It's ${hidden.phrase}!`;
    $("revealNote").textContent =
        asked === 0
            ? "Wow, no questions at all!"
            : `You asked ${asked} question${asked === 1 ? "" : "s"} ⭐`;
    const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    blip("win");
    setTimeout(() => {
        if (phase === "reveal") {
            say([cheer, `It's ${hidden.phrase}!`], true, 1.0, 120);
        }
    }, 380);
    const c = $("confetti");
    const colors = [
        "#FF5A4E",
        "#F2B33D",
        "#3CC47C",
        "#4FA8FF",
        "#B57BFF",
        "#FF8CC6",
    ];
    for (let i = 0; i < 60; i++) {
        const p = document.createElement("i");
        p.style.left = Math.random() * 100 + "vw";
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
        p.style.animationDelay = Math.random() * 0.6 + "s";
        c.appendChild(p);
    }
    $("againBtn").focus({ preventScroll: true });
}

/* ===================== hold-to-guess ===================== */
const GUESS_HOLD_MS = 1000;
let guessRaf = 0;
let guessStart = 0;

function cancelGuessHold() {
    if (guessRaf) {
        cancelAnimationFrame(guessRaf);
        guessRaf = 0;
    }
    guessedBtn.classList.remove("holding");
    guessedBtn.style.setProperty("--hold", "0%");
}

function startGuessHold() {
    if (phase !== "ask" || guessRaf) return;
    guessStart = performance.now();
    guessedBtn.classList.add("holding");
    const tick = (now) => {
        const pct = Math.min(
            100,
            ((now - guessStart) / GUESS_HOLD_MS) * 100,
        );
        guessedBtn.style.setProperty("--hold", pct + "%");
        if (pct >= 100) {
            guessRaf = 0;
            reveal();
        } else {
            guessRaf = requestAnimationFrame(tick);
        }
    };
    guessRaf = requestAnimationFrame(tick);
}

guessedBtn.addEventListener("pointerdown", (e) => {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    try {
        guessedBtn.setPointerCapture(e.pointerId);
    } catch (_) {}
    startGuessHold();
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) =>
    guessedBtn.addEventListener(ev, cancelGuessHold),
);
guessedBtn.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        startGuessHold();
    }
});
guessedBtn.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") cancelGuessHold();
});
guessedBtn.addEventListener("contextmenu", (e) => e.preventDefault());

/* ===================== drag & tap ===================== */
function lookAt(clientX, clientY) {
    const r = bag.getBoundingClientRect();
    const cx = r.left + r.width * 0.5,
        cy = r.top + r.height * 0.64;
    const dx = clientX - cx,
        dy = clientY - cy,
        d = Math.hypot(dx, dy) || 1;
    pupils.style.transform = `translate(${(dx / d) * 5}px, ${(dy / d) * 5}px)`;
}

function overBag(x, y) {
    const r = bag.getBoundingClientRect();
    const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
    return Math.hypot(x - cx, y - cy) < r.width * 0.65;
}

function bindDrag(el, item) {
    let sx,
        sy,
        ox,
        oy,
        t0,
        moved = false,
        active = false;
    el.addEventListener("pointerdown", (e) => {
        if (phase !== "hide") return;
        e.preventDefault();
        active = true;
        moved = false;
        t0 = Date.now();
        sx = e.clientX;
        sy = e.clientY;
        ox = parseFloat(el.style.getPropertyValue("--x"));
        oy = parseFloat(el.style.getPropertyValue("--y"));
        el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
        if (!active) return;
        const dx = e.clientX - sx,
            dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) > 8) {
            moved = true;
            el.classList.add("dragging");
        }
        if (!moved) return;
        el.style.transform = `translate(${ox + dx}px, ${oy + dy}px) translate(-50%, -50%) scale(1.15)`;
        lookAt(e.clientX, e.clientY);
        bag.classList.toggle("hungry", !overBag(e.clientX, e.clientY));
    });
    const end = (e) => {
        if (!active) return;
        active = false;
        pupils.style.transform = "";
        if (!moved) {
            if (Date.now() - t0 < 600) hide(item, el);
            return;
        }
        if (overBag(e.clientX, e.clientY)) {
            hide(item, el);
            return;
        }
        el.classList.remove("dragging");
        el.style.transform = "";
        bag.classList.add("hungry");
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
}

/* ===================== bag boop & sound clue interactions ===================== */
let boopTimes = [];
let boopTimer = 0;

function resetBagFace() {
    clearTimeout(boopTimer);
    boopTimer = 0;
    bag.classList.remove("boop");
    smileEl.setAttribute("d", "M86,166 Q100,182 114,166");
    smileEl.setAttribute("fill", "none");
    if (phase === "hide") bag.classList.add("hungry");
}

function spawnMouthBurst() {
    const colors = [
        "#FF5A4E",
        "#F2B33D",
        "#3CC47C",
        "#4FA8FF",
        "#B57BFF",
        "#FF8CC6",
    ];
    const cx = stage.clientWidth / 2;
    const cy = stage.clientHeight * 0.42;
    for (let i = 0; i < 14; i++) {
        const dot = document.createElement("i");
        const angle = -Math.PI * 0.85 + (i / 13) * (Math.PI * 0.7);
        const dist = 65 + Math.random() * 55;
        dot.className = "bag-burst";
        dot.style.left = cx + "px";
        dot.style.top = cy + "px";
        dot.style.background = colors[i % colors.length];
        dot.style.setProperty(
            "--dx",
            Math.round(Math.cos(angle) * dist) + "px",
        );
        dot.style.setProperty(
            "--dy",
            Math.round(Math.sin(angle) * dist - 15) + "px",
        );
        dot.style.setProperty(
            "--rot",
            Math.round((Math.random() - 0.5) * 540) + "deg",
        );
        stage.appendChild(dot);
        setTimeout(() => dot.remove(), 780);
    }
}

function boopEmptyBag() {
    if (phase !== "hide") return;
    const now = Date.now();
    boopTimes = boopTimes.filter((t) => now - t < 2000);
    boopTimes.push(now);

    clearTimeout(boopTimer);
    bag.classList.remove("hungry", "boop");
    void bag.offsetWidth;
    bag.classList.add("boop");
    smileEl.setAttribute("d", "M82,162 Q100,194 118,162 Z");
    smileEl.setAttribute("fill", "var(--mouth)");

    if (boopTimes.length >= 3) {
        boopTimes = [];
        blip("bleh");
        say("Bleh! Nothing in here!");
        spawnMouthBurst();
    } else {
        const line = GIGGLES[Math.floor(Math.random() * GIGGLES.length)];
        blip("giggle");
        say(line);
    }

    boopTimer = setTimeout(resetBagFace, 680);
}

function setPeek(on) {
    if (phase !== "ask") return;
    bag.classList.toggle("open", on);
    bag.classList.toggle("peeking", on);
    pupils.style.transform = on ? "translate(0, -5px)" : "";
}

bag.addEventListener("pointerdown", (e) => {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    if (phase === "hide") {
        boopEmptyBag();
        return;
    }
    try {
        bag.setPointerCapture(e.pointerId);
    } catch (_) {}
    setPeek(true);
});

["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) =>
    bag.addEventListener(ev, () => setPeek(false)),
);
bag.addEventListener("contextmenu", (e) => e.preventDefault());
bag.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        if (phase === "hide") boopEmptyBag();
        else setPeek(true);
    }
});
bag.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") setPeek(false);
});

/* ===================== buttons ===================== */
$("logoBtn").addEventListener("click", () => {
    blip("pop");
    newRound();
});
$("againBtn").addEventListener("click", newRound);
$("restartBtn").addEventListener("click", newRound);

function paintTheme() {
    if (themePref === "auto") {
        document.documentElement.removeAttribute("data-theme");
    } else {
        document.documentElement.setAttribute("data-theme", themePref);
    }
    const isDark =
        themePref === "dark" ||
        (themePref === "auto" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
    $("themeBtn").textContent = isDark ? "☀️" : "🌙";
    $("themeBtn").setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme",
    );
}
$("themeBtn").addEventListener("click", () => {
    const currentlyDark =
        themePref === "dark" ||
        (themePref === "auto" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
    themePref = currentlyDark ? "light" : "dark";
    try {
        localStorage.setItem("bag-theme", themePref);
    } catch (e) {}
    paintTheme();
    blip("pop");
});
paintTheme();

function paintSound() {
    $("soundBtn").textContent = soundOn ? "🔊" : "🔇";
    $("soundBtn").setAttribute(
        "aria-label",
        soundOn ? "Sound on" : "Sound off",
    );
}
$("soundBtn").addEventListener("click", () => {
    soundOn = !soundOn;
    try {
        localStorage.setItem("bag-sound", soundOn ? "on" : "off");
    } catch (e) {}
    if (!soundOn) stopVoice();
    paintSound();
    blip("pop");
});
paintSound();

function paintHelper() {
    document.body.dataset.helper = helperOn ? "on" : "off";
    $("helperBtn").classList.toggle("off", !helperOn);
    $("helperBtn").setAttribute(
        "aria-label",
        helperOn ? "Answer helper on" : "Answer helper off",
    );
    $("helperBtn").setAttribute("aria-pressed", helperOn);
}
$("helperBtn").addEventListener("click", () => {
    helperOn = !helperOn;
    try {
        localStorage.setItem("bag-helper", helperOn ? "on" : "off");
    } catch (e) {}
    paintHelper();
    blip("pop");
    if (phase === "ask") {
        setPrompt(
            "What’s in the bag? 🤔",
            helperOn
                ? "Tap a question, then tap again to peek"
                : "Tap a question to ask it",
        );
        if (!helperOn) {
            questionsEl.querySelectorAll(".q.asked").forEach((card) => {
                if (card._replace) card._replace();
            });
        }
    }
});
paintHelper();

// no pinch-zoom or long-press menus for little hands
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

newRound();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () =>
        navigator.serviceWorker.register("./sw.js").catch(() => {}),
    );
}
