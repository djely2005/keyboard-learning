import exData from './exercies.json' with {type: 'json'};
import keyboardLayoutData from './keyboard_layouts.json' with {type: 'json'}

const EXERCISES = exData;
const KEYBOARD_LAYOUTS = keyboardLayoutData;


let currentLevel = 0;
let currentExerciseIndex = 0;
let targetText = "";
let currentIndex = 0;
let currentLayout = "AZERTY";
let soundEnabled = true;
let totalErrors = 0;
let totalTyped = 0;
let shiftActive = false;

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'error') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(110, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'victory') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                const noteOsc = audioCtx.createOscillator();
                const noteGain = audioCtx.createGain();
                noteOsc.connect(noteGain);
                noteGain.connect(audioCtx.destination);

                noteOsc.type = 'sine';
                noteOsc.frequency.setValueAtTime(freq, now + i * 0.1);
                noteGain.gain.setValueAtTime(0.2, now + i * 0.1);
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);

                noteOsc.start(now + i * 0.1);
                noteOsc.stop(now + i * 0.1 + 0.3);
            });
        }
    } catch (e) {
        console.log("Audio not allowed yet");
    }
}

function speakCurrentText() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(targetText);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
    }
}

const keyboardEl = document.getElementById('virtual-keyboard');
const typingArea = document.getElementById('typing-area');
const levelSelect = document.getElementById('level-select');

function toggleShift() {
    shiftActive = !shiftActive;
    console.log('test')
    renderVirtualKeyboard();
}

function resetShift() {
    if (shiftActive) {
        shiftActive = false;
        renderVirtualKeyboard();
    }
}

// Returns { base, shift } for any layout key entry
function normalizeKey(entry) {
    if (typeof entry === "string") {
        if (/^[a-z]$/.test(entry)) {
            return { base: entry, shift: entry.toUpperCase() };
        }
        // Everything else shifts to itself
        return { base: entry, shift: entry };
    }
    return entry;
}

// The character produced by a key given current shift state
function getVirtualKeyValue(entry) {
    const { base, shift } = normalizeKey(entry);
    return shiftActive ? shift : base;
}

// Find the original layout entry matching a base character
function findKeyEntry(baseChar) {
    const target = baseChar.toLowerCase();
    for (const row of KEYBOARD_LAYOUTS[currentLayout]) {
        for (const item of row) {
            if (item === 'shift' || item === 'Space') continue;
            const { base } = normalizeKey(item);
            if (base.toLowerCase() === target) {
                return item;
            }
        }
    }
    return null;
}

function renderVirtualKeyboard() {
    keyboardEl.innerHTML = '';

    const layout = KEYBOARD_LAYOUTS[currentLayout];

    layout.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'flex justify-center gap-1 md:gap-1.5 w-full';

        row.forEach(entry => {
            const keyBtn = document.createElement('div');
            const isSpace = entry === 'Space';
            const isShift = entry === 'shift';

            keyBtn.className = `
                flex items-center justify-center font-bold text-sm md:text-lg
                rounded-xl md:rounded-2xl
                border-b-4 border-slate-300 bg-slate-100 text-slate-700
                shadow-sm transition-all duration-75 cursor-pointer
                ${isSpace
                    ? 'w-1/2 max-w-xs py-2 md:py-3'
                    : 'flex-1 py-2 md:py-3 max-w-[50px]'}
                ${isShift && shiftActive
                    ? 'bg-amber-400 text-white border-amber-500'
                    : ''}
            `;

            if (isShift) {
                keyBtn.innerText = '⇧';
                keyBtn.dataset.key = 'shift';
            } else if (isSpace) {
                keyBtn.innerText = 'Espace';
                keyBtn.dataset.key = 'space';
            } else {
                const { base, shift } = normalizeKey(entry);
                keyBtn.innerText = shiftActive ? shift : base;
                keyBtn.dataset.key = base.toLowerCase();
            }

            rowEl.appendChild(keyBtn);
        });

        keyboardEl.appendChild(rowEl);
    });

    updateHighlightedKey();
}

function updateHighlightedKey() {
    document
        .querySelectorAll('.key-target')
        .forEach(el => el.classList.remove('key-target'));

    document
        .querySelectorAll('.shift-required')
        .forEach(el => el.classList.remove('shift-required'));

    if (currentIndex >= targetText.length) return;

    const charToType = targetText[currentIndex];

    const keyToFind = charToType === ' '
        ? 'space'
        : charToType.toLowerCase();

    const keyEl = document.querySelector(
        `[data-key="${CSS.escape(keyToFind)}"]`
    );

    if (keyEl) {
        keyEl.classList.add('key-target');
    }

    const requiresShift =
        charToType !== charToType.toLowerCase() ||
        isShiftSymbol(charToType);

    if (requiresShift) {
        const shiftEl = document.querySelector('[data-key="shift"]');
        if (shiftEl) {
            shiftEl.classList.add('shift-required');
        }
    }
}

function isShiftSymbol(char) {
    const shiftedSymbols = [
        '!', '@', '#', '$', '%', '^', '&', '*',
        '(', ')', '_', '+',
        '?', '>', '<', ':', '"', '|', '~',
        '¨', '£', 'µ', '§', '°'
    ];

    return shiftedSymbols.includes(char);
}

function loadExercise() {
    const levelList = EXERCISES[currentLevel];
    targetText = levelList[currentExerciseIndex % levelList.length];
    currentIndex = 0;
    totalErrors = 0;
    totalTyped = 0;
    shiftActive = false;

    renderTextDisplay();
    updateStats();
    updateHighlightedKey();

    return levelList;
}

function renderTextDisplay() {
    typingArea.innerHTML = '';

    for (let i = 0; i < targetText.length; i++) {
        const charSpan = document.createElement('span');
        const char = targetText[i];

        // Handle space rendering & width
        if (char === ' ') {
            charSpan.innerText = '\u00A0'; // Non-breaking space to guarantee width
            charSpan.classList.add('inline-block', 'w-6', 'md:w-8'); // Forces explicit width for spaces
        } else {
            charSpan.innerText = char;
            charSpan.classList.add('tracking-tighter'); // Tightens space between adjacent letters
        }

        charSpan.dataset.index = i;

        if (i < currentIndex) {
            charSpan.className += ' text-emerald-600 font-bold border-b-4 border-emerald-400';
        } else if (i === currentIndex) {
            charSpan.className += ' text-slate-800 bg-amber-200/80 rounded border-b-4 border-amber-500 font-bold relative animate-pulse';
        } else {
            charSpan.className += ' text-slate-300 font-semibold';
        }

        typingArea.appendChild(charSpan);
    }

    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    typingArea.appendChild(cursor);
}

function handleInput(pressedKey) {
    if (currentIndex >= targetText.length) return;

    const expectedChar = targetText[currentIndex];
    totalTyped++;

    let isCorrect = false;

    if (expectedChar === ' ' && pressedKey === ' ') {
        isCorrect = true;
    } else if (pressedKey === expectedChar) {
        isCorrect = true;
    }

    if (isCorrect) {
        playSound('correct');
        currentIndex++;
        renderTextDisplay();
        updateHighlightedKey();
        updateStats();

        if (currentIndex >= targetText.length) {
            setTimeout(handleVictory, 300);
        }
    } else {
        totalErrors++;
        playSound('error');
        updateStats();

        const card = document.getElementById('typing-card');
        card.classList.add('shake-error');
        setTimeout(() => card.classList.remove('shake-error'), 300);

        const pressedKeyEl = document.querySelector(
            `[data-key="${CSS.escape(pressedKey.toLowerCase())}"]`
        );
        if (pressedKeyEl) {
            pressedKeyEl.classList.add('bg-red-400', 'text-white');
            setTimeout(() => {
                pressedKeyEl.classList.remove('bg-red-400', 'text-white');
            }, 300);
        }
    }
}

function handleBackspace() {
    if (currentIndex <= 0) return;

    currentIndex--;
    if (totalTyped > 0) totalTyped--;

    renderTextDisplay();
    updateHighlightedKey();
    updateStats();
}

function updateStats() {
    const progressEl = document.getElementById('stat-progress');
    const accuracyEl = document.getElementById('stat-accuracy');
    const starsEl = document.getElementById('stat-stars');

    progressEl.innerText = `${currentIndex} / ${targetText.length}`;

    const accuracy = totalTyped > 0
        ? Math.max(0, Math.round(((totalTyped - totalErrors) / totalTyped) * 100))
        : 100;

    accuracyEl.innerText = `${accuracy}%`;

    if (accuracy >= 90) starsEl.innerText = '⭐ ⭐ ⭐';
    else if (accuracy >= 70) starsEl.innerText = '⭐ ⭐ ☆';
    else starsEl.innerText = '⭐ ☆ ☆';
}

function handleVictory() {
    playSound('victory');

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }

    const accuracy = totalTyped > 0
        ? Math.max(0, Math.round(((totalTyped - totalErrors) / totalTyped) * 100))
        : 100;

    document.getElementById('modal-accuracy').innerText = `Précision : ${accuracy}%`;

    const starsEl = document.getElementById('modal-stars');
    const badgeEl = document.getElementById('modal-badge');

    if (accuracy >= 95) {
        starsEl.innerText = '⭐ ⭐ ⭐';
        badgeEl.innerText = '🏆 Expert de la Frappe !';
    } else if (accuracy >= 80) {
        starsEl.innerText = '⭐ ⭐ ☆';
        badgeEl.innerText = '🥇 Grand Champion !';
    } else {
        starsEl.innerText = '⭐ ☆ ☆';
        badgeEl.innerText = '👍 Bien joué, continue !';
    }

    document.getElementById('victory-modal').classList.remove('hidden');
}

window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        shiftActive = false;
        renderVirtualKeyboard();
    }
})

window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        e.preventDefault();
    }

    if (e.key === 'Shift') {
        shiftActive = true;
        renderVirtualKeyboard();
        return;
    }

    if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
    }

    // Handle Backspace as an undo (no penalty)
    if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
    }

    if (e.key.length > 1) {
        return;
    }

    const pressedKey = e.key;

    // Visual press animation on virtual key
    const lookupKey = pressedKey === ' ' ? 'space' : pressedKey.toLowerCase();
    const keyEl = document.querySelector(`[data-key="${CSS.escape(lookupKey)}"]`);

    if (keyEl) {
        keyEl.classList.add('key-pressed');
        setTimeout(() => {
            keyEl.classList.remove('key-pressed');
        }, 120);
    }

    handleInput(pressedKey);
});

keyboardEl.addEventListener('click', (e) => {
    const target = e.target.closest('[data-key]');
    if (!target) return;

    const key = target.dataset.key;
    if (key === 'shift') {
        toggleShift();
        return;
    }

    if (key === 'space') {
        handleInput(' ');
        return;
    }

    const entry = findKeyEntry(key);
    if (!entry) return;

    const pressedKey = getVirtualKeyValue(entry);
    handleInput(pressedKey);

    // Shift is a one-shot modifier
    if (shiftActive) {
        shiftActive = false;
        renderVirtualKeyboard();
    }
});

typingArea.addEventListener('click', () => {
    typingArea.focus();
});

levelSelect.addEventListener('change', (e) => {
    const partProgression = document.getElementById('part-progress');
    currentLevel = parseInt(e.target.value, 10);
    currentExerciseIndex = 0;
    const exProgression = loadExercise();
    partProgression.innerText = `1/${exProgression.length}`
});

document.getElementById('btn-layout').addEventListener('click', () => {
    currentLayout = currentLayout === 'AZERTY' ? 'QWERTY' : 'AZERTY';
    document.getElementById('label-layout').innerText = currentLayout;
    resetShift();
    renderVirtualKeyboard();
});

document.getElementById('btn-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const icon = document.getElementById('icon-sound');
    const label = document.getElementById('label-sound');

    if (soundEnabled) {
        icon.className = 'fa-solid fa-music text-lg';
        label.innerText = 'Sons ON';
    } else {
        icon.className = 'fa-solid fa-volume-xmark text-lg';
        label.innerText = 'Sons OFF';
    }
});

document.getElementById('btn-speech').addEventListener('click', speakCurrentText);

document.getElementById('btn-next').addEventListener('click', () => {
    currentExerciseIndex++;
    const partProgression = document.getElementById('part-progress');
    const exProgression = loadExercise();
    partProgression.innerText = `${currentExerciseIndex + 1}/${exProgression.length}`
});

document.getElementById('modal-next').addEventListener('click', () => {
    document.getElementById('victory-modal').classList.add('hidden');
    currentExerciseIndex++;
    const partProgression = document.getElementById('part-progress');
    const exProgression = loadExercise();
    partProgression.innerText = `${currentExerciseIndex + 1}/${exProgression.length}`
});

document.getElementById('modal-replay').addEventListener('click', () => {
    document.getElementById('victory-modal').classList.add('hidden');
    const partProgression = document.getElementById('part-progress');
    const exProgression = loadExercise();
    partProgression.innerText = `${currentExerciseIndex + 1}/${exProgression.length}`
});

window.onload = function () {
    renderVirtualKeyboard();
    const partProgression = document.getElementById('part-progress');
    const exProgression = loadExercise();
    partProgression.innerText = `1/${exProgression.length}`
};