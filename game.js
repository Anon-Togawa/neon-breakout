(() => {
  "use strict";

  // ================================================================ CONSTANTS
  const W = 960, H = 640, TAU = Math.PI * 2;
  const WALL = 18, PADDLE_Y = 582, PADDLE_H = 15, PADDLE_BASE_W = 150;
  const BALL_R = 8.5, BRICK_COLS = 12, BRICK_W = 65, BRICK_H = 26;
  const BRICK_GAP = 8, BRICK_LEFT = 46, BRICK_TOP = 96;
  const MAX_LIVES = 5, SLOW_FACTOR = 0.72, MAX_SPEED = 780;
  const FONT = '"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  const BEST_KEY = "neon-breakout-ultra-best";
  const MUTE_KEY = "neon-breakout-ultra-muted";

  // ================================================================ DOM
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const pauseBtn = document.getElementById("pauseBtn");
  const muteBtn = document.getElementById("muteBtn");
  const overlay = document.getElementById("overlay");
  const menuScreen = document.getElementById("menuScreen");
  const pauseScreen = document.getElementById("pauseScreen");
  const gameoverScreen = document.getElementById("gameoverScreen");
  const startBtn = document.getElementById("startBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const restartBtn = document.getElementById("restartBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const menuBestEl = document.getElementById("menuBest");
  const pauseMetaEl = document.getElementById("pauseMeta");
  const finalScoreEl = document.getElementById("finalScore");
  const finalLevelEl = document.getElementById("finalLevel");
  const finalComboEl = document.getElementById("finalCombo");
  const finalBricksEl = document.getElementById("finalBricks");
  const finalBestEl = document.getElementById("finalBest");
  const newRecordEl = document.getElementById("newRecord");

  // ================================================================ PALETTES & LEVELS
  const PALETTES = [
    ["#ff4d8d","#ff8a4c","#ffd93d","#5ef2a0","#3ce0ff","#8b7bff"],
    ["#3ce0ff","#5ef2a0","#c9f66b","#ffd93d","#ff8a4c","#ff4d8d"],
    ["#8b7bff","#ff4d8d","#3ce0ff","#5ef2a0","#ffd93d","#ff8a4c"],
    ["#ff6b6b","#feca57","#48dbfb","#ff9ff3","#54a0ff","#5f27cd"]
  ];

  const LEVEL_THEMES = [
    { name: "热身",     rows: 4, pattern: "full" },
    { name: "棋盘",     rows: 5, pattern: "checker" },
    { name: "金字塔",   rows: 6, pattern: "pyramid" },
    { name: "霓虹雨",   rows: 6, pattern: "stripes" },
    { name: "菱形核心", rows: 7, pattern: "diamond" },
    { name: "锯齿风暴", rows: 6, pattern: "zigzag" },
    { name: "堡垒",     rows: 7, pattern: "fortress" },
    { name: "十字能量", rows: 7, pattern: "cross" }
  ];

  // ================================================================ POWERUP META (6 types!)
  const POWER_META = {
    wide:   { color: "#4cf3ff", label: "挡板加宽" },
    multi:  { color: "#ffd166", label: "三分球" },
    slow:   { color: "#a78bfa", label: "时间减速" },
    life:   { color: "#ff5c9d", label: "生命 +1" },
    shield: { color: "#54a0ff", label: "底部护盾" },
    fire:   { color: "#ff6b00", label: "火球穿透" }
  };

  // ================================================================ STATE
  let dpr = 1, bgCanvas = null, resizeTimer = 0;
  let state = "menu", prevState = "ready";
  let score = 0, best = loadBest(), bestBefore = best;
  let lives = 3, level = 1, combo = 0, maxCombo = 0, newRecord = false;
  let totalBricksDestroyed = 0;

  let bricks = [], balls = [], powerups = [], particles = [], floaters = [], stars = [];
  const paddle = { x: W / 2, y: PADDLE_Y, w: PADDLE_BASE_W, h: PADDLE_H, vx: 0 };
  const keys = { left: false, right: false };
  const pointer = { active: false, x: W / 2, type: "mouse" };
  let pointerDown = false, activePointerId = null, pointerMoved = false;
  let downClientX = 0, downClientY = 0, touchGrab = 0;

  let wideTimer = 0, slowTimer = 0, shieldTimer = 0, fireTimer = 0;
  let shake = 0, flash = 0, flashColor = "255,255,255";
  let levelBanner = 0, levelBannerDuration = 1, bannerTitle = "", bannerSub = "";
  let levelClearTimer = 0, gameOverTimer = 0;
  let time = 0, lastFrame = 0, lastWallSound = 0;
  let comboPulse = 0; // visual pulse for high combos

  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch(e) {}

  // ================================================================ UTILS
  const rgbCache = new Map();
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  function rgba(hex, alpha) {
    let rgb = rgbCache.get(hex);
    if (!rgb) {
      const n = parseInt(hex.slice(1), 16);
      rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, rgb);
    }
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha + ")";
  }
  function padScore(n) { const s = String(Math.max(0, Math.round(n))); return s.length >= 6 ? s : "0".repeat(6 - s.length) + s; }
  function padLevel(n) { return n < 10 ? "0" + n : String(n); }
  function commas(n) { return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function loadBest() { try { const v = parseInt(localStorage.getItem(BEST_KEY) || "0", 10); return Number.isFinite(v) && v > 0 ? v : 0; } catch(e) { return 0; } }
  function saveBest() { try { localStorage.setItem(BEST_KEY, String(best)); } catch(e) {} }
  function levelSpeed(n) { return Math.min(430 + (n - 1) * 22, 620); }
  function slowFactor() { return slowTimer > 0 ? SLOW_FACTOR : 1; }

  function levelConfig(n) {
    const index = (n - 1) % LEVEL_THEMES.length;
    const cycle = Math.floor((n - 1) / LEVEL_THEMES.length);
    const theme = LEVEL_THEMES[index];
    const roman = ["", "II", "III", "IV", "V"][Math.min(cycle, 4)];
    return {
      name: theme.name + (roman ? " " + roman : ""),
      rows: Math.min(theme.rows + Math.min(cycle, 2), 8),
      pattern: theme.pattern,
      moving: n >= 4 // bricks move starting level 4
    };
  }

  function roundRectPath(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  // ================================================================ AUDIO
  const Sound = (() => {
    let ac = null, master = null;
    function init() {
      if (ac) { if (ac.state === "suspended") ac.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); master = ac.createGain(); master.gain.value = 0.3; master.connect(ac.destination); } catch(e) { ac = null; master = null; }
    }
    function tone(freq, duration, type, volume, slideTo, delay) {
      if (!ac || muted) return;
      if (ac.state === "suspended") ac.resume().catch(() => {});
      const t0 = ac.currentTime + (delay || 0);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain); gain.connect(master);
      osc.start(t0); osc.stop(t0 + duration + 0.03);
    }
    return {
      init,
      click()    { tone(640, 0.045, "triangle", 0.12); },
      start()    { tone(220, 0.26, "triangle", 0.13, 660); tone(880, 0.12, "sine", 0.08, 1180, 0.18); },
      paddle()   { tone(180, 0.065, "triangle", 0.18, 300); },
      wall()     { tone(760, 0.028, "sine", 0.035, 900); },
      brick(m)   { tone(480 + Math.min(m, 6) * 42, 0.052, "square", 0.055, 620); },
      breakBrick(m) { tone(300 + Math.min(m, 6) * 34, 0.075, "triangle", 0.14, 520); tone(880 + Math.min(m, 6) * 55, 0.06, "sine", 0.075, 1080, 0.035); },
      power()    { tone(523, 0.08, "triangle", 0.12); tone(659, 0.08, "triangle", 0.11, null, 0.075); tone(880, 0.14, "sine", 0.1, null, 0.15); },
      shield()   { tone(330, 0.12, "sine", 0.1); tone(440, 0.12, "sine", 0.09, null, 0.08); tone(660, 0.18, "triangle", 0.08, null, 0.16); },
      fire()     { tone(200, 0.15, "sawtooth", 0.1, 600); tone(400, 0.12, "square", 0.06, 800, 0.06); },
      shieldBounce() { tone(520, 0.06, "triangle", 0.1, 700); },
      lifeLost() { tone(240, 0.42, "sawtooth", 0.13, 70); tone(120, 0.36, "sine", 0.1, 48, 0.05); },
      gameOver() { tone(330, 0.3, "triangle", 0.14, 220); tone(220, 0.3, "triangle", 0.13, 150, 0.22); tone(120, 0.5, "sawtooth", 0.1, 55, 0.44); },
      levelClear() { [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.16, "triangle", 0.11, null, i * 0.085); }); tone(1319, 0.25, "sine", 0.07, null, 0.36); },
      ambient() {
        if (!ac || muted) return;
        // Subtle low drone
        tone(55, 4, "sine", 0.025, 58);
        tone(82, 3.5, "sine", 0.015, 80, 0.5);
      }
    };
  })();


  // ================================================================ CANVAS SETUP & BACKGROUND
  function setupCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBackground();
  }

  function buildBackground() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = Math.round(W * dpr);
    bgCanvas.height = Math.round(H * dpr);
    const b = bgCanvas.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = b.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#081129"); base.addColorStop(0.55, "#070b1d"); base.addColorStop(1, "#05070f");
    b.fillStyle = base; b.fillRect(0, 0, W, H);
    const glow = (x, y, r, color) => {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
      b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2);
    };
    b.globalCompositeOperation = "lighter";
    glow(160, 80, 430, "rgba(30, 130, 255, .17)");
    glow(815, 570, 470, "rgba(255, 50, 140, .12)");
    glow(520, 260, 380, "rgba(100, 80, 255, .08)");
    glow(700, 120, 300, "rgba(255, 120, 40, .06)");
    b.globalCompositeOperation = "source-over";
    b.strokeStyle = "rgba(100, 150, 255, .052)"; b.lineWidth = 1; b.beginPath();
    for (let x = WALL; x <= W - WALL; x += 48) { b.moveTo(x + 0.5, WALL); b.lineTo(x + 0.5, H); }
    for (let y = WALL; y <= H; y += 48) { b.moveTo(WALL, y + 0.5); b.lineTo(W - WALL, y + 0.5); }
    b.stroke();
    const side = b.createLinearGradient(0, 0, 0, H);
    side.addColorStop(0, "rgba(76, 243, 255, .34)"); side.addColorStop(0.5, "rgba(76, 243, 255, .09)"); side.addColorStop(1, "rgba(76, 243, 255, 0)");
    b.strokeStyle = side; b.lineWidth = 1.5; b.beginPath();
    b.moveTo(WALL, WALL); b.lineTo(WALL, H); b.moveTo(W - WALL, WALL); b.lineTo(W - WALL, H); b.stroke();
    const top = b.createLinearGradient(WALL, 0, W - WALL, 0);
    top.addColorStop(0, "rgba(76, 243, 255, 0)"); top.addColorStop(0.2, "rgba(76, 243, 255, .3)");
    top.addColorStop(0.78, "rgba(160, 120, 255, .3)"); top.addColorStop(1, "rgba(160, 120, 255, 0)");
    b.strokeStyle = top; b.beginPath(); b.moveTo(WALL, WALL); b.lineTo(W - WALL, WALL); b.stroke();
    const vignette = b.createRadialGradient(W/2, H*0.44, H*0.14, W/2, H*0.44, H*0.82);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(0.74, "rgba(0,0,0,.2)"); vignette.addColorStop(1, "rgba(0,0,0,.58)");
    b.fillStyle = vignette; b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = "lighter";
    glow(50, H - 50, 260, "rgba(76, 243, 255, .035)");
    glow(W - 30, 40, 280, "rgba(139, 123, 255, .04)");
    b.globalCompositeOperation = "source-over";
  }

  // ================================================================ STARS
  function resetStars() {
    stars = [];
    for (let i = 0; i < 74; i++) {
      stars.push({ x: WALL + 8 + Math.random() * (W - WALL * 2 - 16), y: WALL + Math.random() * (H - WALL * 2),
        r: 0.4 + Math.random() * 1.25, a: 0.12 + Math.random() * 0.42, speed: 2 + Math.random() * 8, phase: Math.random() * TAU });
    }
  }
  function updateStars(dt) {
    for (const s of stars) { s.y -= s.speed * dt; if (s.y < WALL - 4) { s.y = H - 12; s.x = WALL + 8 + Math.random() * (W - WALL * 2 - 16); } }
  }
  function drawStars() {
    ctx.fillStyle = "#c5ecff";
    for (const s of stars) {
      const alpha = s.a * (0.62 + 0.38 * Math.sin(time * 1.575 + s.phase));
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ================================================================ BRICKS
  function patternHas(pattern, r, c, rows) {
    if (pattern === "checker") return (r + c) % 2 === 0;
    if (pattern === "pyramid") return c >= r && c <= BRICK_COLS - 1 - r;
    if (pattern === "stripes") return c % 3 !== 2;
    if (pattern === "diamond") {
      const dx = Math.abs(c - (BRICK_COLS - 1) / 2) / (BRICK_COLS / 2);
      const dy = Math.abs(r - (rows - 1) / 2) / (rows / 2);
      return dx + dy <= 1.08;
    }
    // NEW patterns
    if (pattern === "zigzag") {
      const offset = r % 2 === 0 ? 0 : 1;
      return (c + offset) % 3 !== 0;
    }
    if (pattern === "fortress") {
      if (r === 0 || r === rows - 1) return true; // top & bottom rows full
      if (c === 0 || c === BRICK_COLS - 1) return true; // side walls
      if (r === Math.floor(rows / 2) && c > 2 && c < BRICK_COLS - 3) return true; // middle bar
      return false;
    }
    if (pattern === "cross") {
      const midC = (BRICK_COLS - 1) / 2;
      const midR = (rows - 1) / 2;
      return Math.abs(c - midC) <= 1.5 || Math.abs(r - midR) <= 0.8;
    }
    return true; // "full"
  }

  function buildLevel(n) {
    bricks = [];
    const config = levelConfig(n);
    const palette = PALETTES[(n - 1) % PALETTES.length];
    const strongChance = Math.min(0.1 + (n - 1) * 0.05, 0.45);

    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (!patternHas(config.pattern, r, c, config.rows)) continue;
        let hp = 1;
        if (Math.random() < strongChance) hp = 2;
        if (hp === 2 && n >= 4 && Math.random() < 0.2) hp = 3;

        const baseX = BRICK_LEFT + c * (BRICK_W + BRICK_GAP);
        bricks.push({
          x: baseX, y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          baseX: baseX, // for moving bricks
          w: BRICK_W, h: BRICK_H, hp, maxHp: hp,
          color: palette[r % palette.length],
          flash: 0, alive: true, row: r, col: c,
          // Moving brick params (activated in higher levels)
          moveSpeed: config.moving ? (0.3 + Math.random() * 0.5) * (r % 2 === 0 ? 1 : -1) : 0,
          movePhase: Math.random() * TAU,
          moveAmp: config.moving ? 18 + Math.random() * 22 : 0
        });
      }
    }
  }


  // ================================================================ UI HELPERS
  function setState(next) { state = next; updatePauseButton(); }
  function updatePauseButton() {
    const usable = state === "playing" || state === "ready" || state === "levelclear" || state === "paused";
    pauseBtn.disabled = !usable;
    pauseBtn.classList.toggle("is-paused", state === "paused");
    pauseBtn.setAttribute("aria-label", state === "paused" ? "继续游戏" : "暂停");
    pauseBtn.title = state === "paused" ? "继续游戏 (P)" : "暂停 (P)";
  }
  function updateHUD() {
    scoreEl.textContent = padScore(score); bestEl.textContent = padScore(best);
    levelEl.textContent = padLevel(level);
    livesEl.textContent = lives > 0 ? "♥".repeat(lives) : "—";
    livesEl.setAttribute("aria-label", lives > 0 ? "剩余生命 " + lives : "无剩余生命");
    menuBestEl.textContent = padScore(best);
  }
  function blurFocus() { if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur(); }
  function showScreen(name) {
    const screens = { menu: menuScreen, pause: pauseScreen, gameover: gameoverScreen };
    Object.keys(screens).forEach(key => { screens[key].classList.toggle("active", key === name); });
    overlay.classList.toggle("is-hidden", !name);
  }

  // ================================================================ CORE SETUP
  function resetEffects() {
    if (slowTimer > 0) { for (const b of balls) { b.vx /= SLOW_FACTOR; b.vy /= SLOW_FACTOR; } }
    wideTimer = 0; slowTimer = 0; fireTimer = 0;
    // Keep shield active across deaths (it's a safety net!)
    if (paddle.w !== PADDLE_BASE_W) { paddle.w = PADDLE_BASE_W; clampPaddle(); }
  }

  function resetBall() {
    balls = [{ x: paddle.x, y: PADDLE_Y - BALL_R - 1.5, vx: 0, vy: 0,
      speed: levelSpeed(level), r: BALL_R, trail: [], stuck: true, dead: false }];
  }

  function clampPaddle() {
    paddle.x = clamp(paddle.x, WALL + paddle.w / 2 + 4, W - WALL - paddle.w / 2 - 4);
  }

  function startGame() {
    Sound.init(); blurFocus();
    score = 0; lives = 3; level = 1; combo = 0; maxCombo = 0;
    bestBefore = best; newRecord = false; totalBricksDestroyed = 0;
    resetEffects(); shieldTimer = 0;
    wideTimer = 0; slowTimer = 0; fireTimer = 0;
    balls = []; powerups = []; particles = []; floaters = [];
    keys.left = false; keys.right = false;
    pointer.active = false; pointerDown = false; activePointerId = null; pointer.x = W / 2;
    paddle.x = W / 2; paddle.w = PADDLE_BASE_W; clampPaddle();
    buildLevel(level); resetBall();
    setState("ready"); showScreen(null); updateHUD();
    const config = levelConfig(level);
    levelBannerDuration = 2.2; levelBanner = levelBannerDuration;
    bannerTitle = "LEVEL " + padLevel(level); bannerSub = config.name;
    shake = 0; flash = 0;
    Sound.start();
  }

  function pauseGame() {
    if (!(state === "playing" || state === "ready" || state === "levelclear")) return;
    prevState = state; setState("paused");
    pauseMetaEl.textContent = "第 " + padLevel(level) + " 关 · " + padScore(score) + " 分";
    showScreen("pause"); Sound.click();
  }
  function resumeGame() {
    if (state !== "paused") return;
    blurFocus(); setState(prevState); showScreen(null);
    lastFrame = performance.now(); Sound.click();
  }
  function togglePause() {
    if (state === "paused") resumeGame();
    else if (state === "playing" || state === "ready" || state === "levelclear") pauseGame();
  }

  function finishGameOver() {
    setState("gameover");
    newRecord = score > bestBefore && score > 0;
    best = Math.max(best, score); saveBest(); updateHUD();
    finalScoreEl.textContent = commas(score);
    finalLevelEl.textContent = String(level);
    finalComboEl.textContent = "×" + maxCombo;
    finalBricksEl.textContent = String(totalBricksDestroyed);
    finalBestEl.textContent = commas(best);
    newRecordEl.classList.toggle("hidden", !newRecord);
    showScreen("gameover");
  }

  function loseLife(x) {
    lives -= 1; combo = 0; resetEffects(); balls = []; powerups = []; updateHUD();
    shake = Math.max(shake, 16); flash = 0.85; flashColor = "255,70,120";
    spawnBurst(x || W / 2, H - 45, "#ff4d8d", 26, 300);
    if (lives <= 0) { setState("dying"); gameOverTimer = 1.05; Sound.gameOver(); }
    else { setState("ready"); resetBall(); Sound.lifeLost(); addFloater(W / 2, PADDLE_Y - 82, "剩余 " + lives + " 条命", "#ff8db8", 15); }
  }

  function levelCleared() {
    setState("levelclear"); levelClearTimer = 1.7; combo = 0; balls = []; powerups = [];
    const bonus = 150 + level * 50;
    addScore(bonus); saveBest();
    spawnBurst(W / 2, PADDLE_Y - 120, "#4cf3ff", 58, 360);
    flash = 0.28; flashColor = "76,243,255";
    levelBannerDuration = 1.7; levelBanner = levelBannerDuration;
    bannerTitle = "LEVEL CLEAR"; bannerSub = "BONUS +" + bonus;
    Sound.levelClear();
  }

  function nextLevel() {
    level += 1; buildLevel(level); resetEffects(); shieldTimer = 0; fireTimer = 0;
    paddle.w = PADDLE_BASE_W; clampPaddle(); resetBall();
    setState("ready");
    const config = levelConfig(level);
    levelBannerDuration = 2.2; levelBanner = levelBannerDuration;
    bannerTitle = "LEVEL " + padLevel(level); bannerSub = config.name;
    updateHUD();
  }

  function launchBall() {
    if (state !== "ready" || !balls.length) return;
    const b = balls[0]; if (!b.stuck) return;
    b.stuck = false; b.speed = levelSpeed(level);
    const angle = (Math.random() * 2 - 1) * 0.16;
    const mag = b.speed * slowFactor();
    b.vx = Math.sin(angle) * mag; b.vy = -Math.cos(angle) * mag;
    setState("playing"); Sound.click();
  }

  // ================================================================ SCORING & PARTICLES
  function addScore(n) { score += n; if (score > best) best = score; updateHUD(); }

  function addFloater(x, y, text, color, size) {
    floaters.push({ x, y, text, color, size: size || 14, life: 0.95, max: 0.95, vy: -44 });
    if (floaters.length > 28) floaters.shift();
  }

  function spawnBurst(x, y, color, count, speed) {
    if (particles.length > 440) count = Math.min(count, 6);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const sp = speed * (0.22 + Math.random() * 0.78);
      const life = 0.36 + Math.random() * 0.55;
      particles.push({ x, y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp - 30,
        life, max: life, size: 1.2 + Math.random() * 2.6, color, alpha: 0.55 + Math.random() * 0.45, spin: Math.random() * TAU });
    }
    if (particles.length > 520) particles.splice(0, particles.length - 520);
  }

  // ================================================================ BRICK HIT & POWERUPS
  function hitBrick(br, ball) {
    br.hp -= 1; br.flash = 1;
    if (br.hp > 0) { Sound.brick(combo); spawnBurst(br.x + br.w / 2, br.y + br.h / 2, br.color, 4, 150); shake = Math.max(shake, 1.2); return; }

    br.alive = false; combo += 1; maxCombo = Math.max(maxCombo, combo);
    totalBricksDestroyed++;
    const mult = Math.min(combo, 5);
    const gain = 10 * br.maxHp * mult;
    addScore(gain);
    if (combo >= 3) comboPulse = 0.4;

    addFloater(br.x + br.w / 2, br.y + br.h / 2, "+" + gain, combo > 1 ? "#ffd166" : br.color, combo > 1 ? 15 : 13);
    spawnBurst(br.x + br.w / 2, br.y + br.h / 2, br.color, 13, 240);
    // Extra shards for strong bricks
    if (br.maxHp >= 2) spawnBurst(br.x + br.w / 2, br.y + br.h / 2, "#ffffff", 6, 180);
    shake = Math.max(shake, 2.5 + mult * 0.45);
    Sound.breakBrick(mult);

    if (Math.random() < 0.15) spawnPowerup(br);
  }

  function spawnPowerup(br) {
    if (powerups.length >= 4) return;
    const roll = Math.random();
    let type;
    if (roll < 0.22) type = "wide";
    else if (roll < 0.40) type = "multi";
    else if (roll < 0.55) type = "slow";
    else if (roll < 0.70) type = "shield";
    else if (roll < 0.88) type = "fire";
    else type = "life";
    if (type === "life" && lives >= MAX_LIVES) type = "slow";

    powerups.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, vy: 138, type,
      color: POWER_META[type].color, spin: Math.random() * TAU, dead: false });
  }

  function scaleBallVelocities(factor) { for (const b of balls) { b.vx *= factor; b.vy *= factor; } }

  function applyPower(type) {
    const meta = POWER_META[type];
    if (type === "wide") {
      if (wideTimer <= 0) { paddle.w = Math.min(PADDLE_BASE_W + 72, 238); clampPaddle(); }
      wideTimer = 12;
    } else if (type === "multi") {
      spawnMultiBalls();
    } else if (type === "slow") {
      if (slowTimer <= 0) scaleBallVelocities(SLOW_FACTOR);
      slowTimer = 5.5;
    } else if (type === "life") {
      if (lives < MAX_LIVES) { lives += 1; updateHUD(); } else { addScore(150); }
    } else if (type === "shield") {
      shieldTimer = 10;
      Sound.shield();
    } else if (type === "fire") {
      fireTimer = 6;
      Sound.fire();
    }
    addFloater(paddle.x, PADDLE_Y - 38, meta.label, meta.color, 14);
    spawnBurst(paddle.x, PADDLE_Y, meta.color, 17, 230);
    if (type !== "shield" && type !== "fire") Sound.power();
  }

  function spawnMultiBalls() {
    const source = balls.find(b => !b.stuck);
    if (!source) return;
    const count = Math.min(2, Math.max(0, 6 - balls.length));
    if (count === 0) { addScore(80); return; }
    const baseAngle = Math.atan2(source.vy, source.vx);
    const speed = Math.hypot(source.vx, source.vy);
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i % 2 === 0 ? 0.34 : -0.34);
      balls.push({ x: clamp(source.x + Math.cos(angle) * 12, WALL + BALL_R + 2, W - WALL - BALL_R - 2),
        y: source.y + Math.sin(angle) * 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        speed: source.speed, r: BALL_R, trail: [], stuck: false, dead: false });
    }
  }


  // ================================================================ UPDATE LOGIC
  function updatePaddle(dt) {
    const prev = paddle.x;
    if (keys.left || keys.right) {
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      paddle.x += dir * 1020 * dt;
    } else if (pointer.active) {
      const k = 1 - Math.exp(-28 * dt);
      paddle.x += (pointer.x - paddle.x) * k;
    }
    clampPaddle();
    paddle.vx = (paddle.x - prev) / Math.max(dt, 0.0001);
  }

  function updateEffects(dt) {
    if (wideTimer > 0) {
      wideTimer = Math.max(0, wideTimer - dt);
      if (wideTimer === 0) { paddle.w = PADDLE_BASE_W; clampPaddle(); }
    }
    if (slowTimer > 0) {
      slowTimer = Math.max(0, slowTimer - dt);
      if (slowTimer === 0) scaleBallVelocities(1 / SLOW_FACTOR);
    }
    if (shieldTimer > 0) {
      shieldTimer = Math.max(0, shieldTimer - dt);
    }
    if (fireTimer > 0) {
      fireTimer = Math.max(0, fireTimer - dt);
    }
    if (comboPulse > 0) {
      comboPulse = Math.max(0, comboPulse - dt * 1.5);
    }
  }

  function stickBall() {
    if (!balls.length) return;
    const b = balls[0];
    if (b.stuck) {
      b.x = paddle.x;
      b.y = PADDLE_Y - BALL_R - 1.5;
      b.vx = 0;
      b.vy = 0;
    }
  }

  function updateBricks(dt) {
    for (const br of bricks) {
      if (!br.alive) continue;
      if (br.moveSpeed !== 0) {
        br.movePhase += br.moveSpeed * dt * 2.8;
        br.x = br.baseX + Math.sin(br.movePhase) * br.moveAmp;
        br.x = clamp(br.x, WALL + 4, W - WALL - br.w - 4);
      }
    }
  }

  function updatePowerups(dt) {
    if (!powerups.length) return;
    for (const p of powerups) {
      p.y += p.vy * dt;
      p.spin += dt * 1.5;
      if (
        p.y + 12 >= PADDLE_Y &&
        p.y - 12 <= PADDLE_Y + paddle.h + 4 &&
        Math.abs(p.x - paddle.x) <= paddle.w / 2 + 14
      ) {
        p.dead = true;
        applyPower(p.type);
      }
    }
    powerups = powerups.filter(p => !p.dead && p.y < H + 30);
  }

  function wallSound() {
    const now = performance.now();
    if (now - lastWallSound > 45) {
      lastWallSound = now;
      Sound.wall();
    }
  }

  function collideWalls(b) {
    if (b.x - b.r < WALL) {
      b.x = WALL + b.r;
      b.vx = Math.abs(b.vx);
      wallSound();
    } else if (b.x + b.r > W - WALL) {
      b.x = W - WALL - b.r;
      b.vx = -Math.abs(b.vx);
      wallSound();
    }

    if (b.y - b.r < WALL) {
      b.y = WALL + b.r;
      b.vy = Math.abs(b.vy);
      wallSound();
    }

    // Shield barrier at bottom
    if (shieldTimer > 0 && b.y + b.r >= H - 18 && b.vy > 0) {
      b.y = H - 18 - b.r;
      b.vy = -Math.abs(b.vy);
      shake = Math.max(shake, 3);
      spawnBurst(b.x, H - 18, "#54a0ff", 16, 260);
      Sound.shieldBounce();
    }
  }

  function collideBricks(b) {
    for (const br of bricks) {
      if (!br.alive) continue;
      const nx = clamp(b.x, br.x, br.x + br.w);
      const ny = clamp(b.y, br.y, br.y + br.h);
      const dx = b.x - nx;
      const dy = b.y - ny;
      if (dx * dx + dy * dy > b.r * b.r) continue;

      // In Fireball mode, pierce right through without bouncing!
      if (fireTimer > 0) {
        spawnBurst(nx, ny, "#ff6b00", 8, 220);
        hitBrick(br, b);
        continue;
      }

      const cx = br.x + br.w / 2;
      const cy = br.y + br.h / 2;
      const overlapX = br.w / 2 + b.r - Math.abs(b.x - cx);
      const overlapY = br.h / 2 + b.r - Math.abs(b.y - cy);

      if (overlapX < overlapY) {
        const sign = b.x < cx ? -1 : 1;
        b.x += sign * overlapX;
        b.vx = sign * Math.abs(b.vx);
      } else {
        const sign = b.y < cy ? -1 : 1;
        b.y += sign * overlapY;
        b.vy = sign * Math.abs(b.vy);
      }

      hitBrick(br, b);
      break;
    }
  }

  function collidePaddle(b) {
    if (b.vy <= 0) return;
    const half = paddle.w / 2;
    if (b.x + b.r < paddle.x - half || b.x - b.r > paddle.x + half) return;
    if (b.y + b.r < PADDLE_Y || b.y - b.r > PADDLE_Y + paddle.h) return;

    b.y = PADDLE_Y - b.r - 0.2;
    const rel = clamp((b.x - paddle.x) / (half + b.r * 0.4), -1, 1);
    const angle = rel * 1.02;

    b.speed = Math.min(b.speed * 1.016 + 1, MAX_SPEED);
    const mag = b.speed * slowFactor();
    let vx = Math.sin(angle) * mag + clamp(paddle.vx, -1000, 1000) * 0.035;
    let vy = -Math.cos(angle) * mag;
    const m = Math.hypot(vx, vy) || 1;
    b.vx = (vx / m) * mag;
    b.vy = (vy / m) * mag;

    combo = 0;
    spawnBurst(b.x, PADDLE_Y, "#4cf3ff", 6, 150);
    shake = Math.max(shake, 1);
    Sound.paddle();
  }

  function updateBalls(dt) {
    let anyDead = false;
    let lostX = W / 2;

    for (const b of balls) {
      if (b.stuck) continue;

      const speed = Math.hypot(b.vx, b.vy);
      const steps = Math.max(1, Math.min(14, Math.ceil((speed * dt) / 5)));
      const sdt = dt / steps;

      for (let s = 0; s < steps; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        collideWalls(b);
        collideBricks(b);
        collidePaddle(b);
        if (b.y - b.r > H + 16) break;
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > (fireTimer > 0 ? 24 : 16)) b.trail.shift();

      // Fireball extra sparks
      if (fireTimer > 0 && Math.random() < 0.45) {
        particles.push({
          x: b.x + (Math.random() - 0.5) * 6,
          y: b.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 40 - b.vx * 0.1,
          vy: (Math.random() - 0.5) * 40 - b.vy * 0.1,
          life: 0.25, max: 0.25, size: 2.2,
          color: Math.random() < 0.5 ? "#ff3838" : "#ffb142",
          alpha: 0.8, spin: 0
        });
      }

      if (b.y - b.r > H + 16) {
        b.dead = true;
        anyDead = true;
        lostX = b.x;
      }
    }

    if (anyDead) {
      balls = balls.filter(b => !b.dead);
      if (balls.length === 0 && state === "playing") {
        loseLife(lostX);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.vx *= 0.988;
      p.spin += dt * 4;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateFloaters(dt) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y += f.vy * dt;
      f.vy *= 0.97;
      f.life -= dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

  let ambientTimer = 0;

  function update(dt) {
    time += dt;
    updateStars(dt);

    ambientTimer += dt;
    if (ambientTimer > 7.5) {
      ambientTimer = 0;
      if (state === "playing" || state === "ready") Sound.ambient();
    }

    if (state === "paused") return;

    updateParticles(dt);
    updateFloaters(dt);

    if (levelBanner > 0) levelBanner = Math.max(0, levelBanner - dt);
    for (const br of bricks) {
      if (br.flash > 0) br.flash = Math.max(0, br.flash - dt * 4.5);
    }

    shake *= Math.exp(-6 * dt);
    if (shake < 0.03) shake = 0;
    flash = Math.max(0, flash - dt * 1.7);

    if (state === "menu") {
      paddle.x = W / 2 + Math.sin(time * 0.7) * 170;
      clampPaddle();
      if (balls[0]) {
        balls[0].x = paddle.x;
        balls[0].y = PADDLE_Y - BALL_R - 1.5;
      }
      return;
    }

    if (state === "ready") {
      updatePaddle(dt);
      updateEffects(dt);
      stickBall();
      return;
    }

    if (state === "playing") {
      updatePaddle(dt);
      updateEffects(dt);
      updateBricks(dt);
      updateBalls(dt);

      if (state === "playing") {
        updatePowerups(dt);
        if (bricks.length > 0 && bricks.every(b => !b.alive)) levelCleared();
      }
      return;
    }

    if (state === "levelclear") {
      levelClearTimer -= dt;
      if (levelClearTimer <= 0) nextLevel();
      return;
    }

    if (state === "dying") {
      gameOverTimer -= dt;
      if (gameOverTimer <= 0) finishGameOver();
    }
  }


  // ================================================================ RENDER LOGIC
  function drawBricks() {
    for (const br of bricks) {
      if (!br.alive) continue;
      const strong = br.maxHp > 1;
      ctx.save();
      roundRectPath(ctx, br.x, br.y, br.w, br.h, 7);
      ctx.fillStyle = rgba(br.color, strong ? 0.36 : 0.24);
      ctx.fill();

      // Moving brick dynamic border pulse
      if (br.moveSpeed !== 0) {
        ctx.strokeStyle = "rgba(255,255,255," + (0.35 + 0.25 * Math.sin(time * 6 + br.movePhase)) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.strokeStyle = rgba(br.color, 0.21);
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = rgba(br.color, strong ? 0.98 : 0.74);
      ctx.lineWidth = strong ? 1.8 : 1.25;
      ctx.stroke();

      if (br.maxHp > 1) {
        roundRectPath(ctx, br.x + 4.5, br.y + 4.5, br.w - 9, br.h - 9, 4);
        ctx.strokeStyle = rgba(br.color, 0.2 + 0.14 * (br.maxHp - 1));
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const shine = ctx.createLinearGradient(0, br.y, 0, br.y + br.h);
      shine.addColorStop(0, "rgba(255,255,255,.24)");
      shine.addColorStop(0.4, "rgba(255,255,255,.02)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      roundRectPath(ctx, br.x, br.y, br.w, br.h, 7);
      ctx.fill();

      if (br.flash > 0) {
        roundRectPath(ctx, br.x, br.y, br.w, br.h, 7);
        ctx.fillStyle = "rgba(255,255,255," + (br.flash * 0.48) + ")";
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPowerIcon(type) {
    ctx.save();
    ctx.strokeStyle = "rgba(245,255,255,.95)";
    ctx.fillStyle = "rgba(245,255,255,.95)";
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (type === "wide") {
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(-6, 0); ctx.lineTo(-2.6, -3.4);
      ctx.moveTo(-6, 0); ctx.lineTo(-2.6, 3.4);
      ctx.moveTo(6, 0);  ctx.lineTo(2.6, -3.4);
      ctx.moveTo(6, 0);  ctx.lineTo(2.6, 3.4);
      ctx.stroke();
    } else if (type === "multi") {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * 5, i === 0 ? -1.5 : 1.5, 2.1, 0, TAU);
        ctx.fill();
      }
    } else if (type === "slow") {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -6.5, Math.sin(a) * -6.5);
        ctx.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5);
        ctx.stroke();
      }
    } else if (type === "life") {
      ctx.beginPath();
      ctx.moveTo(0, 6.5);
      ctx.bezierCurveTo(-10, -1, -6.5, -9, 0, -4);
      ctx.bezierCurveTo(6.5, -9, 10, -1, 0, 6.5);
      ctx.fill();
    } else if (type === "shield") {
      // Shield icon: a sleek energy barrier
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, -6);
      ctx.lineTo(6, 0);
      ctx.quadraticCurveTo(6, 7, 0, 9);
      ctx.quadraticCurveTo(-6, 7, -6, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fill();
    } else if (type === "fire") {
      // Flame icon
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.bezierCurveTo(4, -4, 7, -1, 5, 5);
      ctx.bezierCurveTo(3, 9, -3, 9, -5, 5);
      ctx.bezierCurveTo(-7, 0, -3, -3, 0, -8);
      ctx.fillStyle = "rgba(255,200,80,0.95)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 3, 2, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPowerups() {
    for (const p of powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.spin) * 0.16);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(15, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(-15, 0);
      ctx.closePath();
      ctx.fillStyle = rgba(p.color, 0.17);
      ctx.fill();
      ctx.strokeStyle = rgba(p.color, 0.92);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.shadowBlur = 0;
      drawPowerIcon(p.type);
      ctx.restore();
    }
  }

  function drawBalls() {
    if (!balls.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const isFire = fireTimer > 0;
    const isSlow = slowTimer > 0;
    const rgb = isFire ? "255,107,0" : (isSlow ? "167,139,250" : "76,243,255");
    const coreColor = isFire ? "#ffeaa7" : "#f2ffff";

    for (const b of balls) {
      // Trail
      for (let i = 0; i < b.trail.length; i++) {
        const t = (i + 1) / b.trail.length;
        ctx.globalAlpha = t * t * (isFire ? 0.55 : 0.34);
        ctx.fillStyle = isFire ? (i % 2 === 0 ? "rgb(255,71,87)" : "rgb(255,165,2)") : "rgb(" + rgb + ")";
        ctx.beginPath();
        ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (0.2 + t * (isFire ? 1.0 : 0.66)), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Halo
      const radius = b.r * (isFire ? 5.5 : 4.2);
      const halo = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
      halo.addColorStop(0, "rgba(" + rgb + ",.65)");
      halo.addColorStop(0.34, "rgba(" + rgb + ",.22)");
      halo.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, TAU);
      ctx.fill();

      // Core
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.78, 0, TAU);
      ctx.fill();

      // Ring
      ctx.strokeStyle = "rgba(" + rgb + ",.95)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();

      // Specular shine
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.32, b.r * 0.26, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (b.stuck) {
        ctx.strokeStyle = "rgba(" + rgb + "," + (0.16 + 0.12 * Math.sin(time * 4)) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 6, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPaddle() {
    const x = paddle.x - paddle.w / 2;
    const y = PADDLE_Y;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const under = ctx.createRadialGradient(paddle.x, y + 12, 0, paddle.x, y + 12, paddle.w * 0.66);
    under.addColorStop(0, "rgba(76,243,255,.15)");
    under.addColorStop(1, "rgba(76,243,255,0)");
    ctx.fillStyle = under;
    ctx.fillRect(paddle.x - paddle.w * 0.7, y - 24, paddle.w * 1.4, 74);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(76,243,255,.85)";
    ctx.shadowBlur = 24;
    roundRectPath(ctx, x, y, paddle.w, paddle.h, 7);
    const grad = ctx.createLinearGradient(0, y, 0, y + paddle.h);
    grad.addColorStop(0, "#d9ffff");
    grad.addColorStop(0.28, "#66f0ff");
    grad.addColorStop(0.72, "#28baff");
    grad.addColorStop(1, "#5b64ff");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    roundRectPath(ctx, x, y, paddle.w, paddle.h, 7);
    ctx.strokeStyle = "rgba(224,255,255,.85)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 2.2);
    ctx.lineTo(x + paddle.w - 9, y + 2.2);
    ctx.stroke();

    ctx.fillStyle = "#eaffff";
    ctx.beginPath();
    ctx.arc(x + 7, y + paddle.h / 2, 2.1, 0, TAU);
    ctx.arc(x + paddle.w - 7, y + paddle.h / 2, 2.1, 0, TAU);
    ctx.fill();

    if (wideTimer > 0) {
      roundRectPath(ctx, x - 2, y - 2, paddle.w + 4, paddle.h + 4, 9);
      ctx.strokeStyle = "rgba(255,209,102,.34)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawShield() {
    if (shieldTimer <= 0) return;
    const y = H - 18;
    const pulse = Math.sin(time * 8) * 0.2 + 0.8;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Shield glow beam
    const g = ctx.createLinearGradient(0, y - 10, 0, y + 10);
    g.addColorStop(0, "rgba(84,160,255,0)");
    g.addColorStop(0.5, "rgba(84,160,255," + (0.35 * pulse) + ")");
    g.addColorStop(1, "rgba(84,160,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(WALL, y - 8, W - WALL * 2, 16);

    // Core laser line
    ctx.strokeStyle = "rgba(180,225,255," + pulse + ")";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#54a0ff";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(WALL + 2, y);
    ctx.lineTo(W - WALL - 2, y);
    ctx.stroke();

    // Shield label in center
    ctx.font = "600 8px " + FONT;
    ctx.fillStyle = "rgba(180,225,255,0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("SHIELD ACTIVE (" + Math.ceil(shieldTimer) + "s)", W / 2, y - 3);

    ctx.restore();
  }

  function drawParticles() {
    if (!particles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.max) * p.alpha;
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, p.size * (p.life / p.max)), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    if (!floaters.length) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floaters) {
      const alpha = Math.min(1, (f.life / f.max) * 1.8);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = "700 " + f.size + "px " + FONT;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawTimerPills() {
    const items = [];
    if (wideTimer > 0) items.push({ label: "加宽", sec: wideTimer, frac: wideTimer / 12, color: "#4cf3ff" });
    if (slowTimer > 0) items.push({ label: "减速", sec: slowTimer, frac: slowTimer / 5.5, color: "#a78bfa" });
    if (shieldTimer > 0) items.push({ label: "护盾", sec: shieldTimer, frac: shieldTimer / 10, color: "#54a0ff" });
    if (fireTimer > 0) items.push({ label: "火球", sec: fireTimer, frac: fireTimer / 6, color: "#ff6b00" });
    if (!items.length) return;

    let x = WALL + 10;
    const y = 28;
    const w = 66;
    const h = 18;

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.font = "600 9px " + FONT;

    for (const item of items) {
      roundRectPath(ctx, x, y, w, h, 9);
      ctx.fillStyle = rgba(item.color, 0.1);
      ctx.fill();
      ctx.strokeStyle = rgba(item.color, 0.34);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.textAlign = "left";
      ctx.fillText(item.label + " " + Math.ceil(item.sec) + "s", x + 8, y + 8.5);

      ctx.fillStyle = rgba(item.color, 0.18);
      ctx.fillRect(x + 8, y + h - 4, w - 16, 1.5);
      ctx.fillStyle = rgba(item.color, 0.85);
      ctx.fillRect(x + 8, y + h - 4, (w - 16) * clamp(item.frac, 0, 1), 1.5);

      x += w + 8;
    }
    ctx.restore();
  }

  function drawCombo() {
    if (state !== "playing" || combo < 2) return;
    const mult = Math.min(combo, 5);
    const scale = 1 + Math.sin(time * 7) * 0.035;
    ctx.save();
    ctx.translate(W - WALL - 12, 38);
    ctx.scale(scale, scale);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "800 18px " + FONT;
    ctx.fillStyle = "#ffe08a";
    ctx.shadowColor = "rgba(255,209,102,.6)";
    ctx.shadowBlur = 14;
    ctx.fillText("×" + mult, 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = "700 8px " + FONT;
    ctx.fillStyle = "rgba(255,224,138,.66)";
    ctx.fillText("COMBO", 0, 14);
    ctx.restore();
  }

  function drawReadyHint() {
    if (state !== "ready" || !balls.length) return;
    const b = balls[0];
    ctx.save();
    ctx.globalAlpha = 0.36 + 0.14 * Math.sin(time * 3.4);
    ctx.strokeStyle = "#a9eaff";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 19);
    ctx.lineTo(b.x, b.y - 86);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "500 10px " + FONT;
    ctx.fillStyle = "rgba(190,232,255,.72)";
    ctx.fillText("空格 / 点击发射", b.x, PADDLE_Y + 38);
    ctx.restore();
  }

  function drawLevelBanner() {
    if (levelBanner <= 0) return;
    const elapsed = levelBannerDuration - levelBanner;
    const alpha = Math.max(0, Math.min(1, elapsed / 0.16, levelBanner / 0.34));
    if (alpha <= 0) return;

    const y = H * 0.635;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const line = ctx.createLinearGradient(W / 2 - 190, 0, W / 2 + 190, 0);
    line.addColorStop(0, "rgba(76,243,255,0)");
    line.addColorStop(0.5, "rgba(120,240,255,.62)");
    line.addColorStop(1, "rgba(139,123,255,0)");
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 175, y - 36);
    ctx.lineTo(W / 2 + 175, y - 36);
    ctx.stroke();

    ctx.font = "800 40px " + FONT;
    ctx.fillStyle = "#eafdff";
    ctx.shadowColor = "rgba(76,243,255,.55)";
    ctx.shadowBlur = 26;
    ctx.fillText(bannerTitle, W / 2, y);

    ctx.shadowBlur = 0;
    ctx.font = "600 12px " + FONT;
    ctx.fillStyle = "#8fe9ff";
    ctx.fillText(bannerSub, W / 2, y + 33);

    ctx.beginPath();
    ctx.moveTo(W / 2 - 175, y + 55);
    ctx.lineTo(W / 2 + 175, y + 55);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);
    drawStars();

    const sx = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;

    ctx.save();
    ctx.translate(sx, sy);
    drawBricks();
    drawPowerups();
    drawShield();
    drawBalls();
    drawPaddle();
    drawParticles();
    drawFloaters();
    ctx.restore();

    drawTimerPills();
    drawCombo();
    drawReadyHint();
    drawLevelBanner();

    // High combo full-screen edge pulse
    if (comboPulse > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,209,102," + (comboPulse * 0.4) + ")";
      ctx.lineWidth = 12 * comboPulse;
      ctx.strokeRect(0, 0, W, H);
      ctx.restore();
    }

    if (flash > 0) {
      ctx.fillStyle = "rgba(" + flashColor + "," + Math.min(0.4, flash * 0.4) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(now) {
    if (!lastFrame) lastFrame = now;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ================================================================ INPUT
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H
    };
  }

  function onPointerDown(e) {
    if (pointerDown) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (state === "menu" || state === "paused" || state === "gameover" || state === "dying" || state === "levelclear") return;

    Sound.init();
    const p = toWorld(e.clientX, e.clientY);
    pointerDown = true;
    activePointerId = e.pointerId;
    pointerMoved = false;
    downClientX = e.clientX;
    downClientY = e.clientY;
    pointer.type = e.pointerType || "mouse";
    pointer.active = true;

    if (e.pointerType === "touch") {
      touchGrab = paddle.x - p.x;
      pointer.x = paddle.x;
    } else {
      pointer.x = p.x;
    }

    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (e.pointerType === "touch" && !pointerDown) return;

    if (pointerDown && Math.hypot(e.clientX - downClientX, e.clientY - downClientY) > 9) {
      pointerMoved = true;
    }

    const p = toWorld(e.clientX, e.clientY);
    if (pointerDown && e.pointerType === "touch") {
      pointer.x = p.x + touchGrab;
    } else {
      pointer.x = p.x;
    }
    pointer.type = e.pointerType || "mouse";
    pointer.active = true;
  }

  function onPointerUp(e) {
    if (!pointerDown || e.pointerId !== activePointerId) return;
    pointerDown = false;
    activePointerId = null;
    pointer.active = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}

    if (!pointerMoved && state === "ready") launchBall();
  }

  function onPointerCancel(e) {
    if (e.pointerId !== activePointerId) return;
    pointerDown = false;
    activePointerId = null;
    pointer.active = false;
  }

  // ================================================================ UI LISTENERS
  function applyMuteUI() {
    muteBtn.classList.toggle("is-muted", muted);
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.setAttribute("aria-label", muted ? "开启声音" : "关闭声音");
    muteBtn.title = muted ? "开启声音" : "关闭声音";
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (err) {}
    applyMuteUI();
    Sound.init();
    if (!muted) Sound.click();
    muteBtn.blur();
  }

  startBtn.addEventListener("click", startGame);
  playAgainBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);
  resumeBtn.addEventListener("click", resumeGame);
  pauseBtn.addEventListener("click", () => {
    togglePause();
    pauseBtn.blur();
  });
  muteBtn.addEventListener("click", toggleMute);

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && !pointerDown) pointer.active = false;
  });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);

  window.addEventListener("keydown", (e) => {
    const code = e.code;
    if (code === "ArrowLeft" || code === "KeyA") {
      keys.left = true;
      pointer.active = false;
      e.preventDefault();
      return;
    }
    if (code === "ArrowRight" || code === "KeyD") {
      keys.right = true;
      pointer.active = false;
      e.preventDefault();
      return;
    }

    if (code === "Space" || code === "Enter") {
      if (document.activeElement && document.activeElement.tagName === "BUTTON") return;
      e.preventDefault();
      Sound.init();
      if (state === "menu") startGame();
      else if (state === "ready") launchBall();
      else if (state === "paused") resumeGame();
      else if (state === "gameover") startGame();
      return;
    }

    if (code === "KeyP" || code === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }

    if (code === "KeyR") {
      if (state === "gameover" || state === "paused") {
        e.preventDefault();
        startGame();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  });

  window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;
    pointerDown = false;
    pointer.active = false;
    if (state === "playing" || state === "ready" || state === "levelclear") pauseGame();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state === "playing" || state === "ready" || state === "levelclear") pauseGame();
    } else {
      lastFrame = performance.now();
    }
  });

  window.addEventListener("pagehide", saveBest);

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupCanvas, 100);
  });

  // ================================================================ INIT
  function init() {
    setupCanvas();
    resetStars();
    paddle.x = W / 2;
    clampPaddle();
    buildLevel(1);
    resetBall();
    resetEffects();
    updateHUD();
    updatePauseButton();
    applyMuteUI();
    showScreen("menu");
    setState("menu");
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  init();
})();
