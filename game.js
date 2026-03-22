/**
 * 触控练枪场 — 单文件（utils / audio / particles / targets / game / boot）
 */
(function (global) {
  "use strict";

  /* ---------- utils ---------- */
  var AimUtils = {
    clamp: function (v, min, max) {
      return Math.max(min, Math.min(max, v));
    },
    lerp: function (a, b, t) {
      return a + (b - a) * t;
    },
    distSq: function (ax, ay, bx, by) {
      var dx = ax - bx;
      var dy = ay - by;
      return dx * dx + dy * dy;
    },
    rand: function (min, max) {
      return min + Math.random() * (max - min);
    },
  };
  global.AimUtils = AimUtils;

  /* ---------- audio ---------- */
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }
  function beep(freq, duration, type, gainValue) {
    var c = getAudioCtx();
    if (!c) return;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gainValue || 0.12, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration + 0.05);
  }
  var AimAudio = {
    resume: function () {
      var c = getAudioCtx();
      if (c && c.state === "suspended") c.resume();
    },
    playHit: function (headshot) {
      AimAudio.resume();
      if (headshot) {
        beep(880, 0.06, "square", 0.1);
        setTimeout(function () {
          beep(1320, 0.05, "square", 0.08);
        }, 40);
      } else {
        beep(520, 0.07, "triangle", 0.11);
      }
    },
    playMiss: function () {
      AimAudio.resume();
      beep(180, 0.08, "sawtooth", 0.06);
    },
    playSpawn: function () {
      AimAudio.resume();
      beep(220, 0.03, "sine", 0.04);
    },
  };
  global.AimAudio = AimAudio;

  /* ---------- particles ---------- */
  function Particle(x, y, vx, vy, life, color, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }
  Particle.prototype.update = function (dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 420 * dt;
    this.life -= dt;
    return this.life > 0;
  };
  Particle.prototype.draw = function (ctx) {
    var a = this.life / this.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  var AimParticles = {
    burst: function (list, x, y, headshot) {
      var n = headshot ? 18 : 12;
      var base = headshot ? "#fff5a0" : "#ff6b7a";
      var i;
      for (i = 0; i < n; i++) {
        var ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        var sp = AimUtils.rand(120, 320);
        list.push(
          new Particle(
            x,
            y,
            Math.cos(ang) * sp,
            Math.sin(ang) * sp - 80,
            AimUtils.rand(0.35, 0.55),
            i % 3 === 0 ? "#ffffff" : base,
            AimUtils.rand(3, 7)
          )
        );
      }
    },
    flash: function (list, x, y) {
      list.push({
        x: x,
        y: y,
        r: 8,
        life: 0.12,
        maxLife: 0.12,
        update: function (dt) {
          this.life -= dt;
          this.r += 280 * dt;
          return this.life > 0;
        },
        draw: function (ctx) {
          var a = this.life / this.maxLife;
          ctx.globalAlpha = a * 0.45;
          ctx.strokeStyle = "#ff4655";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        },
      });
    },
  };
  global.AimParticles = AimParticles;

  /* ---------- targets ---------- */
  var U = AimUtils;
  function Target(cfg) {
    this.x = cfg.x;
    this.y = cfg.y;
    this.r = cfg.r;
    this.mode = cfg.mode;
    this.vx = cfg.vx || 0;
    this.vy = cfg.vy || 0;
    this.life = cfg.life;
    this.maxLife = cfg.life;
    this.initialLife = cfg.mode === "reaction" ? cfg.life : 0;
    this.spawnT = cfg.spawnT || 0;
    this.pulse = 0;
  }
  Target.HEAD_RATIO = 0.32;
  Target.prototype.headRadius = function () {
    return this.r * Target.HEAD_RATIO;
  };
  Target.prototype.update = function (dt, w, h) {
    this.pulse += dt * 6;
    if (this.mode === "reaction") {
      this.life -= dt;
      return this.life > 0;
    }
    if (this.mode === "moving") {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < this.r) {
        this.x = this.r;
        this.vx *= -1;
      } else if (this.x > w - this.r) {
        this.x = w - this.r;
        this.vx *= -1;
      }
      if (this.y < this.r) {
        this.y = this.r;
        this.vy *= -1;
      } else if (this.y > h - this.r) {
        this.y = h - this.r;
        this.vy *= -1;
      }
    }
    return true;
  };
  Target.prototype.draw = function (ctx) {
    var headR = this.headRadius();
    var alpha = 1;
    if (this.mode === "reaction" && this.initialLife > 0) {
      alpha = U.clamp(this.life / this.initialLife, 0.25, 1);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    var g = ctx.createRadialGradient(
      this.x - this.r * 0.3,
      this.y - this.r * 0.3,
      0,
      this.x,
      this.y,
      this.r
    );
    g.addColorStop(0, "rgba(255,120,130,0.95)");
    g.addColorStop(0.55, "rgba(255,70,85,0.85)");
    g.addColorStop(1, "rgba(140,30,45,0.9)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(10,14,20,0.75)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };
  function pickMode(difficulty) {
    var r = Math.random();
    var staticP = U.clamp(0.36 - difficulty * 0.04, 0.22, 0.4);
    var moveP = 0.38;
    if (r < staticP) return "static";
    if (r < staticP + moveP) return "moving";
    return "reaction";
  }
  function spawnTarget(w, h, gameTime, difficulty) {
    var rad = U.clamp(U.rand(22, 38) - difficulty * 2, 18, 40);
    var margin = rad + 8;
    var x = U.rand(margin, w - margin);
    var y = U.rand(margin, h - margin);
    var mode = pickMode(difficulty);
    var vx = 0;
    var vy = 0;
    if (mode === "moving") {
      var sp = U.rand(45, 95) + difficulty * 15;
      var ang = Math.random() * Math.PI * 2;
      vx = Math.cos(ang) * sp;
      vy = Math.sin(ang) * sp;
    }
    var life = 9999;
    if (mode === "reaction") {
      life = U.clamp(0.55 - difficulty * 0.06, 0.28, 0.55);
    }
    return new Target({
      x: x,
      y: y,
      r: rad,
      mode: mode,
      vx: vx,
      vy: vy,
      life: life,
      spawnT: gameTime,
    });
  }
  var AimTargets = { Target: Target, spawn: spawnTarget };
  global.AimTargets = AimTargets;

  /* ---------- game ---------- */
  var Particles = AimParticles;
  var Targets = AimTargets;
  var Audio = AimAudio;
  var ROUND_SECONDS = 30;
  var SPAWN_MIN = 0.5;
  var SPAWN_MAX_START = 1.45;
  var STORAGE_KEY = "varolant_aim_highscore_v1";

  function HitMarker(x, y, t) {
    this.x = x;
    this.y = y;
    this.t = t;
    this.maxT = t;
  }

  function AimGame(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.callbacks = callbacks || {};
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.state = "menu";
    this.timeLeft = ROUND_SECONDS;
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.highScore = 0;
    this.loadHighScore();
    this.sensitivity = 1;
    this.smooth = 0.88;
    this.recoilAmount = 1;
    this.targets = [];
    this.particles = [];
    this.hitMarkers = [];
    this.spawnTimer = 0;
    this.spawnInterval = SPAWN_MAX_START;
    this.difficulty = 0;
    this.elapsed = 0;
    this.aimTouchId = null;
    this.hasAimFinger = false;
    this.crossX = 0;
    this.crossY = 0;
    this.aimTargetX = 0;
    this.aimTargetY = 0;
    this.recoilX = 0;
    this.recoilY = 0;
    this.lastShotAt = -1;
    this._lastTs = 0;
    this._boundTick = this._tick.bind(this);
  }

  AimGame.prototype.loadHighScore = function () {
    try {
      var v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      if (!isNaN(v)) this.highScore = v;
    } catch (e) {}
  };
  AimGame.prototype.saveHighScore = function () {
    try {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem(STORAGE_KEY, String(this.highScore));
      }
    } catch (e) {}
  };
  AimGame.prototype.resize = function () {
    this.dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    var rect = this.canvas.getBoundingClientRect();
    this.w = Math.floor(rect.width * this.dpr);
    this.h = Math.floor(rect.height * this.dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.crossX = this.w * 0.5;
    this.crossY = this.h * 0.5;
    this.aimTargetX = this.crossX;
    this.aimTargetY = this.crossY;
  };
  AimGame.prototype.screenToCanvas = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    var sx = this.w / rect.width;
    var sy = this.h / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  };
  AimGame.prototype.isRightZone = function (clientX) {
    return clientX >= global.innerWidth * 0.5;
  };
  AimGame.prototype.isLeftZone = function (clientX) {
    return clientX < global.innerWidth * 0.5;
  };
  AimGame.prototype.setAimFromClient = function (clientX, clientY) {
    var p = this.screenToCanvas(clientX, clientY);
    var cx = this.w * 0.5;
    var cy = this.h * 0.5;
    var tx = cx + (p.x - cx) * this.sensitivity;
    var ty = cy + (p.y - cy) * this.sensitivity;
    this.aimTargetX = U.clamp(tx, 8, this.w - 8);
    this.aimTargetY = U.clamp(ty, 8, this.h - 8);
  };
  AimGame.prototype.onTouchStart = function (e) {
    if (this.state !== "playing") return;
    var i;
    for (i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (this.isRightZone(t.clientX)) {
        if (this.aimTouchId === null) {
          this.aimTouchId = t.identifier;
          this.hasAimFinger = true;
          this.setAimFromClient(t.clientX, t.clientY);
        }
      } else if (this.isLeftZone(t.clientX)) {
        this.fire();
      }
    }
  };
  AimGame.prototype.onTouchMove = function (e) {
    if (this.state !== "playing" || this.aimTouchId === null) return;
    var i;
    for (i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === this.aimTouchId) {
        this.setAimFromClient(t.clientX, t.clientY);
        break;
      }
    }
  };
  AimGame.prototype.onTouchEnd = function (e) {
    var i;
    for (i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === this.aimTouchId) {
        this.aimTouchId = null;
        this.hasAimFinger = false;
      }
    }
  };
  AimGame.prototype.fire = function () {
    if (this.state !== "playing") return;
    this.shots += 1;
    this.lastShotAt = this.elapsed;
    var ax = this.crossX;
    var ay = this.crossY;
    var rec = 14 * this.recoilAmount;
    this.recoilX += U.rand(-rec, rec);
    this.recoilY += U.rand(-rec, rec);
    var best = -1;
    var bestD = 1e15;
    var j;
    for (j = 0; j < this.targets.length; j++) {
      var tar = this.targets[j];
      var d = U.distSq(ax, ay, tar.x, tar.y);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best >= 0) {
      var tg = this.targets[best];
      if (bestD <= tg.r * tg.r) {
        var hr = tg.headRadius();
        var headshot = U.distSq(ax, ay, tg.x, tg.y) <= hr * hr;
        var base = headshot ? 120 : 60;
        var mult = 1 + Math.min(this.combo, 20) * 0.05;
        var pts = Math.floor(base * mult);
        this.score += pts;
        this.hits += 1;
        this.combo += 1;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        Particles.burst(this.particles, tg.x, tg.y, headshot);
        Particles.flash(this.particles, tg.x, tg.y);
        this.hitMarkers.push(new HitMarker(tg.x, tg.y, 0.22));
        Audio.playHit(headshot);
        this.targets.splice(best, 1);
        this._notifyHud();
        return;
      }
    }
    this.combo = 0;
    Audio.playMiss();
    if (global.navigator && global.navigator.vibrate) {
      try {
        global.navigator.vibrate(18);
      } catch (err) {}
    }
    if (this.callbacks.onMiss) this.callbacks.onMiss();
    this._notifyHud();
  };
  AimGame.prototype._notifyHud = function () {
    if (this.callbacks.onHud) {
      this.callbacks.onHud({
        score: this.score,
        shots: this.shots,
        hits: this.hits,
        combo: this.combo,
        timeLeft: this.timeLeft,
        highScore: this.highScore,
      });
    }
  };
  AimGame.prototype.refreshHud = function () {
    this._notifyHud();
  };
  AimGame.prototype.startRenderLoop = function () {
    this._lastTs = performance.now();
    global.requestAnimationFrame(this._boundTick);
  };
  AimGame.prototype._tick = function (ts) {
    var dt = Math.min(0.05, (ts - this._lastTs) / 1000);
    this._lastTs = ts;
    this.update(dt);
    this.draw();
    global.requestAnimationFrame(this._boundTick);
  };
  AimGame.prototype.start = function () {
    Audio.resume();
    this.resize();
    this.state = "playing";
    this.timeLeft = ROUND_SECONDS;
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.targets = [];
    this.particles = [];
    this.hitMarkers = [];
    this.spawnTimer = 0.15;
    this.spawnInterval = SPAWN_MAX_START;
    this.difficulty = 0;
    this.elapsed = 0;
    this.aimTouchId = null;
    this.hasAimFinger = false;
    this.crossX = this.w * 0.5;
    this.crossY = this.h * 0.5;
    this.aimTargetX = this.crossX;
    this.aimTargetY = this.crossY;
    this.recoilX = 0;
    this.recoilY = 0;
    this._notifyHud();
  };
  AimGame.prototype.update = function (dt) {
    if (this.state !== "playing") return;
    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endRound();
      return;
    }
    this.difficulty = U.clamp(this.elapsed / ROUND_SECONDS, 0, 1);
    this.spawnInterval =
      SPAWN_MAX_START - (SPAWN_MAX_START - SPAWN_MIN) * this.difficulty;
    this.spawnTimer -= dt;
    var maxTargets = 16;
    if (this.spawnTimer <= 0 && this.targets.length < maxTargets) {
      this.targets.push(Targets.spawn(this.w, this.h, this.elapsed, this.difficulty));
      this.spawnTimer = this.spawnInterval * U.rand(0.85, 1.1);
      Audio.playSpawn();
    } else if (this.targets.length >= maxTargets) {
      this.spawnTimer = U.rand(0.08, 0.15);
    }
    var recDamp = Math.pow(0.12, dt * 60);
    this.recoilX *= recDamp;
    this.recoilY *= recDamp;
    var destX = U.clamp(this.aimTargetX + this.recoilX, 8, this.w - 8);
    var destY = U.clamp(this.aimTargetY + this.recoilY, 8, this.h - 8);
    var k = U.clamp(this.smooth, 0.04, 1);
    if (k >= 0.999) {
      this.crossX = destX;
      this.crossY = destY;
    } else {
      var lerpK = 1 - Math.pow(1 - k, dt * 60);
      this.crossX = U.lerp(this.crossX, destX, lerpK);
      this.crossY = U.lerp(this.crossY, destY, lerpK);
    }
    var i;
    for (i = this.targets.length - 1; i >= 0; i--) {
      if (!this.targets[i].update(dt, this.w, this.h)) {
        this.targets.splice(i, 1);
        this.combo = 0;
      }
    }
    for (i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) this.particles.splice(i, 1);
    }
    for (i = this.hitMarkers.length - 1; i >= 0; i--) {
      var hm = this.hitMarkers[i];
      hm.t -= dt;
      if (hm.t <= 0) this.hitMarkers.splice(i, 1);
    }
    this._notifyHud();
  };
  AimGame.prototype.endRound = function () {
    this.state = "ended";
    this.saveHighScore();
    this._notifyHud();
    if (this.callbacks.onEnd) {
      this.callbacks.onEnd({
        score: this.score,
        shots: this.shots,
        hits: this.hits,
        maxCombo: this.maxCombo,
        highScore: this.highScore,
      });
    }
  };
  AimGame.prototype.drawBackground = function () {
    var ctx = this.ctx;
    var g = ctx.createLinearGradient(0, 0, this.w, this.h);
    g.addColorStop(0, "#0c1219");
    g.addColorStop(0.5, "#0a0e14");
    g.addColorStop(1, "#080b10");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.strokeStyle = "rgba(255,70,85,0.07)";
    ctx.lineWidth = 1 * this.dpr;
    var step = 48 * this.dpr;
    var x;
    var y;
    for (x = 0; x < this.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.h);
      ctx.stroke();
    }
    for (y = 0; y < this.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.w, y);
      ctx.stroke();
    }
  };
  AimGame.prototype.drawCrosshair = function () {
    var ctx = this.ctx;
    var x = this.crossX;
    var y = this.crossY;
    var s = 10 * this.dpr;
    var out = 18 * this.dpr;
    var thick = 2 * this.dpr;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = thick;
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(x - out, y);
    ctx.lineTo(x - s, y);
    ctx.moveTo(x + s, y);
    ctx.lineTo(x + out, y);
    ctx.moveTo(x, y - out);
    ctx.lineTo(x, y - s);
    ctx.moveTo(x, y + s);
    ctx.lineTo(x, y + out);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,70,85,0.95)";
    ctx.lineWidth = 1.2 * this.dpr;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 * this.dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,70,85,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 1 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
  };
  AimGame.prototype.drawHitMarkers = function () {
    var ctx = this.ctx;
    var i;
    for (i = 0; i < this.hitMarkers.length; i++) {
      var hm = this.hitMarkers[i];
      var a = hm.t / hm.maxT;
      var L = 14 * this.dpr * (1.4 - a);
      ctx.strokeStyle = "rgba(255,255,255," + (0.2 + 0.75 * a) + ")";
      ctx.lineWidth = 2.2 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(hm.x - L, hm.y - L);
      ctx.lineTo(hm.x + L, hm.y + L);
      ctx.moveTo(hm.x + L, hm.y - L);
      ctx.lineTo(hm.x - L, hm.y + L);
      ctx.stroke();
    }
  };
  AimGame.prototype.draw = function () {
    var ctx = this.ctx;
    this.drawBackground();
    var i;
    for (i = 0; i < this.targets.length; i++) {
      this.targets[i].draw(ctx);
    }
    for (i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx);
    }
    this.drawHitMarkers();
    this.drawCrosshair();
    if (
      this.state === "playing" &&
      this.lastShotAt >= 0 &&
      this.elapsed - this.lastShotAt < 0.05
    ) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 3 * this.dpr;
      ctx.beginPath();
      ctx.arc(this.crossX, this.crossY, 26 * this.dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
  global.AimGame = AimGame;

  /* ---------- boot ---------- */
  function $(id) {
    return document.getElementById(id);
  }
  function fmtTime(t) {
    return Math.max(0, Math.ceil(t)) + "s";
  }
  function fmtPct(hits, shots) {
    if (!shots) return "—";
    return Math.round((100 * hits) / shots) + "%";
  }
  function boot() {
    var canvas = $("game-canvas");
    var overlay = $("overlay");
    var hudScore = $("hud-score");
    var hudAcc = $("hud-acc");
    var hudTime = $("hud-time");
    var hudCombo = $("hud-combo");
    var toast = $("toast");
    var sensSlider = $("sensitivity");
    var sensVal = $("sensitivity-val");
    var smoothSlider = $("smooth");
    var smoothVal = $("smooth-val");
    var recoilSlider = $("recoil");
    var recoilVal = $("recoil-val");
    var btnStart = $("btn-start");
    var btnRestart = $("btn-restart");
    var endTitle = $("end-title");
    var endDetail = $("end-detail");
    var bestEl = $("best-score");
    var toastTimer = null;
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.classList.remove("show");
      }, 420);
    }
    var game = new AimGame(canvas, {
      onHud: function (d) {
        hudScore.textContent = String(d.score);
        hudAcc.textContent = fmtPct(d.hits, d.shots);
        hudTime.textContent = fmtTime(d.timeLeft);
        hudCombo.textContent = d.combo > 0 ? "×" + d.combo : "—";
        bestEl.innerHTML =
          "最高分：<strong>" + d.highScore + "</strong>（本地）";
      },
      onMiss: function () {
        showToast("未命中");
      },
      onEnd: function (d) {
        endTitle.textContent = "回合结束";
        endDetail.innerHTML =
          "得分 <strong>" +
          d.score +
          "</strong> · 命中 " +
          d.hits +
          "/" +
          d.shots +
          " · 最高连击 " +
          d.maxCombo +
          "<br/>最高分：" +
          d.highScore;
        overlay.classList.remove("hidden");
        $("panel-menu").classList.add("hidden");
        $("panel-end").classList.remove("hidden");
      },
    });
    game.refreshHud();
    function readSliders() {
      game.sensitivity = parseFloat(sensSlider.value, 10) / 100;
      game.smooth = parseFloat(smoothSlider.value, 10) / 100;
      game.recoilAmount = parseFloat(recoilSlider.value, 10) / 100;
      sensVal.textContent = game.sensitivity.toFixed(2);
      smoothVal.textContent = game.smooth.toFixed(2);
      recoilVal.textContent = game.recoilAmount.toFixed(2);
    }
    sensSlider.addEventListener("input", readSliders);
    smoothSlider.addEventListener("input", readSliders);
    recoilSlider.addEventListener("input", readSliders);
    readSliders();
    game.startRenderLoop();
    function onResize() {
      game.resize();
    }
    global.addEventListener("resize", onResize);
    global.addEventListener("orientationchange", onResize);
    onResize();
    canvas.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        game.onTouchStart(e);
      },
      { passive: false }
    );
    canvas.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
        game.onTouchMove(e);
      },
      { passive: false }
    );
    canvas.addEventListener("touchend", function (e) {
      game.onTouchEnd(e);
    });
    canvas.addEventListener("touchcancel", function (e) {
      game.onTouchEnd(e);
    });
    function openMenu() {
      overlay.classList.remove("hidden");
      $("panel-menu").classList.remove("hidden");
      $("panel-end").classList.add("hidden");
    }
    btnStart.addEventListener("click", function () {
      AimAudio.resume();
      overlay.classList.add("hidden");
      readSliders();
      game.start();
    });
    btnRestart.addEventListener("click", function () {
      AimAudio.resume();
      overlay.classList.add("hidden");
      readSliders();
      game.start();
    });
    openMenu();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
