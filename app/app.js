/* Cover Art Studio — GTA-style poster maker.
   Everything here is drawn locally in the browser: photos never upload,
   sample scenes are original illustrations drawn in code, and the export
   is rendered at full resolution on a canvas. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- state
  var LAYOUTS = {
    'hero-duo': [
      { x: 0.00, y: 0.00, w: 0.615, h: 1.00 },
      { x: 0.615, y: 0.00, w: 0.385, h: 0.50 },
      { x: 0.615, y: 0.50, w: 0.385, h: 0.50 },
    ],
    'grid': [
      { x: 0.00, y: 0.00, w: 0.50, h: 0.50 },
      { x: 0.50, y: 0.00, w: 0.50, h: 0.50 },
      { x: 0.00, y: 0.50, w: 0.50, h: 0.50 },
      { x: 0.50, y: 0.50, w: 0.50, h: 0.50 },
    ],
    'trio': [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.58 },
      { x: 0.00, y: 0.58, w: 0.50, h: 0.42 },
      { x: 0.50, y: 0.58, w: 0.50, h: 0.42 },
    ],
  };

  var SIZES = {
    '1080x1080': [1080, 1080],
    '1080x1350': [1080, 1350],
    '1920x1080': [1920, 1080],
  };

  var GRADES = {
    sunset: { filter: 'saturate(1.28) contrast(1.06)', shadow: '#ff2e88' },
    neon:   { filter: 'saturate(1.45) contrast(1.12) brightness(0.92)', shadow: '#19d3e6' },
    clean:  { filter: 'none', shadow: '#160a2e' },
  };

  var state = {
    layout: 'hero-duo',
    grade: 'sunset',
    size: '1920x1080',
    caption: 'VICE CITY',
    captionSize: 96,      // px at 1080px wide
    captionPos: 'bottom',
    captionColor: '#ffffff',
    selected: 0,
    slots: [],            // { img, zoom, ox, oy } — ox/oy are fractions of panel size
  };

  // ------------------------------------------------------- deterministic rng
  function rng(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------- sample scenes (original art)
  function drawPalm(c, x, y, s, lean) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = '#1c0a2e';
    c.lineCap = 'round';
    // trunk
    c.lineWidth = Math.max(3, s * 0.055);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(lean * s * 0.25, -s * 0.55, lean * s * 0.4, -s);
    c.stroke();
    // fronds: fan upward and outward from the crown, tips drooping down
    var tx = lean * s * 0.4, ty = -s;
    c.lineWidth = Math.max(2, s * 0.04);
    for (var i = 0; i < 7; i++) {
      var t = i / 6;                       // 0 = far left, 1 = far right
      var ang = Math.PI * (1.08 + t * 0.84); // sweep over the top of the crown
      var len = s * (0.52 + (i % 2) * 0.10);
      var ex = tx + Math.cos(ang) * len;
      var ey = ty + Math.sin(ang) * len * 0.62 + len * 0.30; // droop at the tip
      c.beginPath();
      c.moveTo(tx, ty);
      c.quadraticCurveTo(tx + (ex - tx) * 0.45, ty - s * 0.30, ex, ey);
      c.stroke();
    }
    // coconuts
    c.fillStyle = '#1c0a2e';
    c.beginPath(); c.arc(tx - 4, ty + 4, s * 0.05, 0, 7); c.fill();
    c.beginPath(); c.arc(tx + 5, ty + 5, s * 0.05, 0, 7); c.fill();
    c.restore();
  }

  function drawBoulevard(c, W, H) {
    var sky = c.createLinearGradient(0, 0, 0, H * 0.66);
    sky.addColorStop(0.00, '#ffd76e');
    sky.addColorStop(0.35, '#ff9e4f');
    sky.addColorStop(0.68, '#ff5e7a');
    sky.addColorStop(1.00, '#c33d8f');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H * 0.66);

    // retro striped sun
    var sx = W * 0.66, sy = H * 0.30, sr = H * 0.15;
    c.save();
    c.shadowColor = '#ffdf6b';
    c.shadowBlur = 70;
    c.fillStyle = '#fff6c9';
    c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
    c.restore();
    c.save();
    c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.clip();
    c.fillStyle = '#ff9e4f';
    var stripeY = sy + sr * 0.05;
    for (var i = 0; i < 4; i++) {
      c.fillRect(sx - sr, stripeY, sr * 2, 3 + i * 3.2);
      stripeY += 13 + i * 4;
    }
    c.restore();

    // clouds
    c.fillStyle = 'rgba(255, 214, 180, 0.5)';
    var clouds = [[0.18, 0.16, 120], [0.42, 0.10, 90], [0.86, 0.20, 110]];
    clouds.forEach(function (cl) {
      c.beginPath();
      c.ellipse(cl[0] * W, cl[1] * H, cl[2], cl[2] * 0.26, 0, 0, 7);
      c.fill();
    });

    // birds
    c.strokeStyle = '#3a1550';
    c.lineWidth = 3;
    [[0.30, 0.22], [0.36, 0.18], [0.52, 0.26]].forEach(function (b) {
      var bx = b[0] * W, by = b[1] * H;
      c.beginPath();
      c.moveTo(bx - 12, by); c.quadraticCurveTo(bx - 4, by - 8, bx, by);
      c.quadraticCurveTo(bx + 4, by - 8, bx + 12, by);
      c.stroke();
    });

    // skyline
    var r = rng(20261119);
    var horizon = H * 0.66;
    c.fillStyle = '#4a1a63';
    var bx = 0;
    while (bx < W) {
      var bw = 60 + r() * 110, bh = 40 + r() * 130;
      c.fillRect(bx, horizon - bh, bw, bh);
      bx += bw + 6;
    }
    // lit windows
    c.fillStyle = '#ffd76e';
    for (var wxi = 0; wxi < 90; wxi++) {
      var wx = r() * W, wy = horizon - 30 - r() * 130;
      c.fillRect(wx, wy, 5, 7);
    }
    c.fillStyle = '#2a0e40';
    c.fillRect(0, horizon - 60, W * 0.16, 60);
    c.fillRect(W * 0.84, horizon - 84, W * 0.16, 84);

    // road
    var vpX = W * 0.5, vpY = horizon;
    c.fillStyle = '#241533';
    c.beginPath();
    c.moveTo(0, H); c.lineTo(W, H); c.lineTo(vpX + 40, vpY); c.lineTo(vpX - 40, vpY);
    c.closePath(); c.fill();
    c.strokeStyle = '#ffe14d';
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(vpX - 46, vpY); c.lineTo(30, H); c.stroke();
    c.beginPath(); c.moveTo(vpX + 46, vpY); c.lineTo(W - 30, H); c.stroke();
    // centre dashes, growing toward the viewer
    c.fillStyle = '#fff3b0';
    var t = 0, y = vpY + 6, len = 6;
    while (y < H) {
      var half = 4 + t * 26;
      c.fillRect(vpX - half / 2, y, half, len);
      y += len + 14 + t * 26;
      len += 9;
      t += 1;
    }
    // sidewalks + palms
    c.fillStyle = '#3d2358';
    c.beginPath(); c.moveTo(0, H); c.lineTo(vpX - 46, vpY); c.lineTo(vpX - 120, vpY); c.lineTo(0, H * 0.86); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(W, H); c.lineTo(vpX + 46, vpY); c.lineTo(vpX + 120, vpY); c.lineTo(W, H * 0.86); c.closePath(); c.fill();
    drawPalm(c, W * 0.10, H * 0.97, H * 0.30, -0.5);
    drawPalm(c, W * 0.24, H * 0.88, H * 0.20, 0.4);
    drawPalm(c, W * 0.90, H * 0.97, H * 0.32, 0.5);
    drawPalm(c, W * 0.76, H * 0.88, H * 0.20, -0.4);
  }

  function drawPier(c, W, H) {
    var sky = c.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0.00, '#070b26');
    sky.addColorStop(0.55, '#141b4d');
    sky.addColorStop(1.00, '#3a1f63');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H * 0.62);

    // stars
    var r = rng(777);
    c.fillStyle = '#ffffff';
    for (var i = 0; i < 110; i++) {
      var a = 0.25 + r() * 0.75;
      c.globalAlpha = a;
      var sz = r() < 0.12 ? 3 : 1.6;
      c.fillRect(r() * W, r() * H * 0.55, sz, sz);
    }
    c.globalAlpha = 1;

    // moon
    c.save();
    c.shadowColor = '#cfe8ff';
    c.shadowBlur = 50;
    c.fillStyle = '#e8f6ff';
    c.beginPath(); c.arc(W * 0.38, H * 0.14, H * 0.07, 0, 7); c.fill();
    c.restore();

    // ferris wheel, neon rim
    var wx = W * 0.68, wy = H * 0.36, wr = H * 0.19;
    c.save();
    c.shadowColor = '#ff2bd6';
    c.shadowBlur = 22;
    c.strokeStyle = '#ff2bd6';
    c.lineWidth = 6;
    c.beginPath(); c.arc(wx, wy, wr, 0, 7); c.stroke();
    c.strokeStyle = '#37f4ff';
    c.shadowColor = '#37f4ff';
    c.lineWidth = 3;
    for (var s = 0; s < 8; s++) {
      var a = s * Math.PI / 4;
      c.beginPath();
      c.moveTo(wx, wy);
      c.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
      c.stroke();
    }
    c.restore();
    // gondolas
    for (var g = 0; g < 8; g++) {
      var ga = g * Math.PI / 4 + 0.2;
      c.fillStyle = g % 2 ? '#37f4ff' : '#ffe14d';
      c.beginPath();
      c.arc(wx + Math.cos(ga) * wr, wy + Math.sin(ga) * wr, 7, 0, 7);
      c.fill();
    }
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(wx, wy, 8, 0, 7); c.fill();
    // wheel legs
    c.strokeStyle = '#1a1440';
    c.lineWidth = 10;
    c.beginPath(); c.moveTo(wx - 14, wy); c.lineTo(wx - wr * 0.55, H * 0.62); c.stroke();
    c.beginPath(); c.moveTo(wx + 14, wy); c.lineTo(wx + wr * 0.55, H * 0.62); c.stroke();

    // neon sign
    c.save();
    c.shadowColor = '#ff2bd6';
    c.shadowBlur = 26;
    c.fillStyle = '#12082a';
    c.strokeStyle = '#ff2bd6';
    c.lineWidth = 5;
    var sw = W * 0.34, sh = H * 0.13, sx = W * 0.30, sy = H * 0.47;
    c.beginPath();
    if (c.roundRect) c.roundRect(sx, sy, sw, sh, 14); else c.rect(sx, sy, sw, sh);
    c.fill(); c.stroke();
    c.shadowColor = '#37f4ff';
    c.shadowBlur = 18;
    c.fillStyle = '#37f4ff';
    c.font = '900 ' + Math.round(sh * 0.52) + 'px "Arial Black", Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('NEON PIER', sx + sw / 2, sy + sh / 2 + 2);
    c.restore();

    // sea
    var sea = c.createLinearGradient(0, H * 0.62, 0, H);
    sea.addColorStop(0, '#0a1030');
    sea.addColorStop(1, '#05081f');
    c.fillStyle = sea;
    c.fillRect(0, H * 0.62, W, H * 0.38);
    // neon reflections
    var rr = rng(4242);
    for (var k = 0; k < 46; k++) {
      var rx = W * 0.45 + rr() * W * 0.5;
      var ry = H * 0.64 + rr() * H * 0.30;
      c.globalAlpha = 0.12 + rr() * 0.4;
      c.fillStyle = rr() < 0.5 ? '#ff2bd6' : '#37f4ff';
      c.fillRect(rx, ry, 20 + rr() * 90, 3 + rr() * 3);
    }
    c.globalAlpha = 1;

    // pier deck, perspective planks
    c.fillStyle = '#2c1a12';
    c.beginPath();
    c.moveTo(0, H); c.lineTo(W, H); c.lineTo(W * 0.62, H * 0.80); c.lineTo(W * 0.38, H * 0.80);
    c.closePath(); c.fill();
    c.strokeStyle = '#120a06';
    c.lineWidth = 3;
    // plank seams fanning from the vanishing point
    var vx = W * 0.5, vy = H * 0.80;
    for (var q = -4; q <= 4; q++) {
      c.beginPath();
      c.moveTo(vx + q * 14, vy);
      c.lineTo(W * (0.5 + q * 0.13), H);
      c.stroke();
    }
    c.beginPath(); c.moveTo(0, H * 0.90); c.lineTo(W, H * 0.90); c.stroke();
    // posts with neon strips
    c.save();
    c.shadowColor = '#37f4ff';
    c.shadowBlur = 16;
    c.fillStyle = '#37f4ff';
    [[0.06, 0.86], [0.94, 0.86], [0.16, 0.83], [0.84, 0.83]].forEach(function (pt) {
      c.fillRect(pt[0] * W - 3, pt[1] * H - 26, 6, 52);
    });
    c.restore();
    // string lights
    c.save();
    c.strokeStyle = '#ffe14d';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(W * 0.06, H * 0.84);
    c.quadraticCurveTo(W * 0.5, H * 0.76, W * 0.94, H * 0.84);
    c.stroke();
    var lr = rng(99);
    for (var l = 0; l <= 12; l++) {
      var lt = l / 12;
      var lx2 = (1 - lt) * (1 - lt) * W * 0.06 + 2 * (1 - lt) * lt * W * 0.5 + lt * lt * W * 0.94;
      var ly2 = (1 - lt) * (1 - lt) * H * 0.84 + 2 * (1 - lt) * lt * H * 0.76 + lt * lt * H * 0.84;
      c.shadowColor = '#ffe14d';
      c.shadowBlur = 12;
      c.fillStyle = lr() < 0.5 ? '#ffe14d' : '#ff5ea8';
      c.beginPath(); c.arc(lx2, ly2 + 6, 4, 0, 7); c.fill();
    }
    c.restore();
  }

  var sampleCache = {};
  function makeSample(kind) {
    if (sampleCache[kind]) return sampleCache[kind];
    var cv = document.createElement('canvas');
    cv.width = 1200; cv.height = 900;
    var c = cv.getContext('2d');
    if (kind === 'pier') drawPier(c, 1200, 900); else drawBoulevard(c, 1200, 900);
    var img = new Image();
    // Samples are data URLs, so they load fast — but still asynchronously.
    // Re-render the preview once each one arrives, or the first paint is empty.
    img.onload = function () { renderPreview(); };
    img.src = cv.toDataURL('image/png');
    sampleCache[kind] = img;
    return img;
  }

  // ------------------------------------------------------------- rendering
  var preview = document.getElementById('preview');

  function clampSlot(slot, pw, ph) {
    var iw = slot.img.naturalWidth || slot.img.width;
    var ih = slot.img.naturalHeight || slot.img.height;
    if (!iw || !ih) return;
    var base = Math.max(pw / iw, ph / ih);
    var dw = iw * base * slot.zoom;
    var dh = ih * base * slot.zoom;
    var mx = Math.max(0, (dw - pw) / 2 / pw);
    var my = Math.max(0, (dh - ph) / 2 / ph);
    slot.ox = Math.max(-mx, Math.min(mx, slot.ox));
    slot.oy = Math.max(-my, Math.min(my, slot.oy));
  }

  function drawPhotoIn(c, slot, px, py, pw, ph) {
    var iw = slot.img.naturalWidth || slot.img.width;
    var ih = slot.img.naturalHeight || slot.img.height;
    if (!iw || !ih) return;
    clampSlot(slot, pw, ph);
    var base = Math.max(pw / iw, ph / ih);
    var dw = iw * base * slot.zoom;
    var dh = ih * base * slot.zoom;
    var dx = px + (pw - dw) / 2 + slot.ox * pw;
    var dy = py + (ph - dh) / 2 + slot.oy * ph;
    c.save();
    c.beginPath();
    c.rect(px, py, pw, ph);
    c.clip();
    c.filter = GRADES[state.grade].filter;
    c.drawImage(slot.img, dx, dy, dw, dh);
    c.filter = 'none';
    applyGrade(c, px, py, pw, ph);
    c.restore();
  }

  function applyGrade(c, px, py, pw, ph) {
    if (state.grade === 'clean') return;
    var g;
    if (state.grade === 'sunset') {
      g = c.createLinearGradient(px, py, px, py + ph);
      g.addColorStop(0.00, 'rgba(255, 190, 80, 0.10)');
      g.addColorStop(0.50, 'rgba(255, 90, 120, 0.20)');
      g.addColorStop(1.00, 'rgba(120, 40, 160, 0.28)');
      c.globalCompositeOperation = 'soft-light';
      c.fillStyle = g;
      c.fillRect(px, py, pw, ph);
      c.globalCompositeOperation = 'source-over';
    } else if (state.grade === 'neon') {
      g = c.createLinearGradient(px, py, px, py + ph);
      g.addColorStop(0.00, 'rgba(0, 240, 255, 0.18)');
      g.addColorStop(1.00, 'rgba(255, 43, 214, 0.22)');
      c.globalCompositeOperation = 'overlay';
      c.fillStyle = g;
      c.fillRect(px, py, pw, ph);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(8, 6, 32, 0.10)';
      c.fillRect(px, py, pw, ph);
    }
    // vignette
    var v = c.createRadialGradient(
      px + pw / 2, py + ph / 2, Math.min(pw, ph) * 0.45,
      px + pw / 2, py + ph / 2, Math.max(pw, ph) * 0.75);
    v.addColorStop(0, 'rgba(10, 0, 30, 0)');
    v.addColorStop(1, 'rgba(10, 0, 30, 0.28)');
    c.fillStyle = v;
    c.fillRect(px, py, pw, ph);
  }

  function wrapCaption(c, text, maxW) {
    var words = text.split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (c.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function drawCaption(c, W, H) {
    var text = (state.caption || '').trim().toUpperCase();
    if (!text) return;
    var base = state.captionSize * (W / 1080);
    var maxW = W * 0.92;
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '900 ' + base + 'px "Arial Black", "Arial Bold", Impact, "Helvetica Neue", sans-serif';
    try { c.letterSpacing = Math.round(base * 0.03) + 'px'; } catch (e) {}
    var size = base;
    var lines = wrapCaption(c, text, maxW);
    while (lines.length > 2 && size > 28) {
      size *= 0.9;
      c.font = '900 ' + size + 'px "Arial Black", "Arial Bold", Impact, "Helvetica Neue", sans-serif';
      lines = wrapCaption(c, text, maxW);
    }
    var lineH = size * 1.04;
    var blockH = lines.length * lineH;
    var bottom = state.captionPos === 'bottom';
    var bandH = Math.max(blockH + size * 0.9, H * 0.24);
    var gy = bottom ? H - bandH : 0;
    var scrim = c.createLinearGradient(0, gy, 0, bottom ? H : bandH);
    if (bottom) {
      scrim.addColorStop(0, 'rgba(10, 5, 25, 0)');
      scrim.addColorStop(1, 'rgba(10, 5, 25, 0.62)');
    } else {
      scrim.addColorStop(0, 'rgba(10, 5, 25, 0.62)');
      scrim.addColorStop(1, 'rgba(10, 5, 25, 0)');
    }
    c.fillStyle = scrim;
    c.fillRect(0, gy, W, bandH);

    var cy = bottom
      ? H - size * 0.62 - (lines.length - 1) * lineH / 2
      : size * 0.62 + (lines.length - 1) * lineH / 2;
    var cx = W / 2;
    var shadowCol = GRADES[state.grade].shadow;
    c.lineJoin = 'round';
    c.miterLimit = 2;
    lines.forEach(function (line, i) {
      var y = cy + (i - (lines.length - 1) / 2) * lineH;
      // offset colour shadow
      c.fillStyle = shadowCol;
      c.fillText(line, cx + size * 0.045, y + size * 0.05);
      // dark outline + fill
      c.strokeStyle = '#160a2e';
      c.lineWidth = Math.max(2, size * 0.10);
      c.strokeText(line, cx, y);
      c.fillStyle = state.captionColor;
      c.fillText(line, cx, y);
    });
    c.restore();
  }

  function drawPoster(c, W, H) {
    c.save();
    c.fillStyle = '#12081f';
    c.fillRect(0, 0, W, H);
    var gap = Math.max(3, W * 0.008);
    var rects = LAYOUTS[state.layout];
    rects.forEach(function (r, i) {
      var px = r.x * W + gap / 2, py = r.y * H + gap / 2;
      var pw = r.w * W - gap, ph = r.h * H - gap;
      var slot = state.slots[i];
      if (slot && slot.img) drawPhotoIn(c, slot, px, py, pw, ph);
      else {
        c.fillStyle = '#2a1840';
        c.fillRect(px, py, pw, ph);
      }
      c.strokeStyle = '#ffffff';
      c.lineWidth = Math.max(2, W * 0.004);
      c.strokeRect(px, py, pw, ph);
    });
    drawCaption(c, W, H);
    c.restore();
  }

  function renderPreview() {
    var dims = SIZES[state.size];
    var W = dims[0], H = dims[1];
    var longSide = 960;
    var pw = W >= H ? longSide : Math.round(longSide * W / H);
    var ph = W >= H ? Math.round(longSide * H / W) : longSide;
    if (preview.width !== pw) preview.width = pw;
    if (preview.height !== ph) preview.height = ph;
    var c = preview.getContext('2d');
    drawPoster(c, pw, ph);
  }

  // ------------------------------------------------------------- export
  function exportPNG(sizeKey) {
    var dims = SIZES[sizeKey || state.size];
    var W = dims[0], H = dims[1];
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    drawPoster(cv.getContext('2d'), W, H);
    return new Promise(function (resolve) {
      cv.toBlob(function (blob) {
        if (!blob) { resolve(null); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cover-' + W + 'x' + H + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        var reader = new FileReader();
        reader.onloadend = function () { resolve(reader.result); };
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
  }

  // ------------------------------------------------------------- controls
  var $ = function (id) { return document.getElementById(id); };
  var layoutRow = $('layoutRow'), gradeRow = $('gradeRow'), sizeRow = $('sizeRow'),
      posRow = $('posRow'), panelRow = $('panelRow');

  function markActive(row, attr, value) {
    row.querySelectorAll('[data-' + attr + ']').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-' + attr) === value);
    });
  }

  function syncPanelRow() {
    panelRow.innerHTML = '';
    LAYOUTS[state.layout].forEach(function (r, i) {
      var b = document.createElement('button');
      b.className = 'chip' + (i === state.selected ? ' active' : '');
      b.textContent = 'Panel ' + (i + 1);
      b.addEventListener('click', function () {
        state.selected = i;
        syncPanelRow();
        syncZoom();
        renderPreview();
      });
      panelRow.appendChild(b);
    });
    $('selectedLabel').textContent = 'Panel ' + (state.selected + 1) + ' selected';
  }

  function syncZoom() {
    var slot = state.slots[state.selected];
    var z = slot ? slot.zoom : 1;
    $('zoom').value = z;
    $('zoomVal').textContent = z.toFixed(2) + '×';
  }

  function setSlotImage(img) {
    state.slots[state.selected] = { img: img, zoom: 1, ox: 0, oy: 0 };
    syncZoom();
    renderPreview();
  }

  function ensureSlots() {
    var n = LAYOUTS[state.layout].length;
    var defaults = ['boulevard', 'pier', 'boulevard', 'pier'];
    while (state.slots.length < n) {
      var kind = defaults[state.slots.length % defaults.length];
      state.slots.push({ img: makeSample(kind), zoom: 1, ox: 0, oy: 0 });
    }
    state.slots.length = n;
    if (state.selected >= n) state.selected = 0;
  }

  layoutRow.addEventListener('click', function (e) {
    var b = e.target.closest('[data-layout]');
    if (!b) return;
    state.layout = b.getAttribute('data-layout');
    ensureSlots();
    markActive(layoutRow, 'layout', state.layout);
    syncPanelRow();
    syncZoom();
    renderPreview();
  });

  gradeRow.addEventListener('click', function (e) {
    var b = e.target.closest('[data-grade]');
    if (!b) return;
    state.grade = b.getAttribute('data-grade');
    markActive(gradeRow, 'grade', state.grade);
    renderPreview();
  });

  sizeRow.addEventListener('click', function (e) {
    var b = e.target.closest('[data-size]');
    if (!b) return;
    state.size = b.getAttribute('data-size');
    markActive(sizeRow, 'size', state.size);
    renderPreview();
  });

  posRow.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pos]');
    if (!b) return;
    state.captionPos = b.getAttribute('data-pos');
    markActive(posRow, 'pos', state.captionPos);
    renderPreview();
  });

  $('sampleA').addEventListener('click', function () { setSlotImage(makeSample('boulevard')); });
  $('sampleB').addEventListener('click', function () { setSlotImage(makeSample('pier')); });
  $('uploadBtn').addEventListener('click', function () { $('fileInput').click(); });
  $('fileInput').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () { setSlotImage(img); };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
    this.value = '';
  });

  $('zoom').addEventListener('input', function () {
    var slot = state.slots[state.selected];
    if (!slot) return;
    slot.zoom = parseFloat(this.value);
    syncZoom();
    renderPreview();
  });

  $('fitBtn').addEventListener('click', function () {
    var slot = state.slots[state.selected];
    if (!slot) return;
    slot.zoom = 1; slot.ox = 0; slot.oy = 0;
    syncZoom();
    renderPreview();
  });

  $('allBtn').addEventListener('click', function () {
    var slot = state.slots[state.selected];
    if (!slot) return;
    state.slots = state.slots.map(function () {
      return { img: slot.img, zoom: 1, ox: 0, oy: 0 };
    });
    renderPreview();
  });

  $('captionText').addEventListener('input', function () {
    state.caption = this.value;
    renderPreview();
  });
  $('captionSize').addEventListener('input', function () {
    state.captionSize = parseInt(this.value, 10);
    $('sizeVal').textContent = this.value;
    renderPreview();
  });
  $('captionColor').addEventListener('change', function () {
    state.captionColor = this.value;
    renderPreview();
  });

  function doExport() {
    $('exportStatus').textContent = 'Exporting…';
    exportPNG(state.size).then(function () {
      $('exportStatus').textContent = 'Saved as PNG (' + state.size.replace('x', ' × ') + ').';
      setTimeout(function () { $('exportStatus').textContent = ''; }, 4000);
    });
  }
  $('exportBtn').addEventListener('click', doExport);
  $('exportBtn2').addEventListener('click', doExport);

  // ------------------------------------------------- preview drag to pan
  var drag = null;
  function canvasPos(e) {
    var r = preview.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * preview.width / r.width,
      y: (e.clientY - r.top) * preview.height / r.height,
    };
  }
  function hitPanel(x, y) {
    var W = preview.width, H = preview.height;
    var rects = LAYOUTS[state.layout];
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.x * W && x < (r.x + r.w) * W && y >= r.y * H && y < (r.y + r.h) * H) return i;
    }
    return -1;
  }
  preview.addEventListener('pointerdown', function (e) {
    var p = canvasPos(e);
    var i = hitPanel(p.x, p.y);
    if (i < 0) return;
    state.selected = i;
    syncPanelRow();
    syncZoom();
    var slot = state.slots[i];
    drag = { x: p.x, y: p.y, ox: slot ? slot.ox : 0, oy: slot ? slot.oy : 0 };
    preview.classList.add('dragging');
    preview.setPointerCapture(e.pointerId);
    renderPreview();
  });
  preview.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var p = canvasPos(e);
    var slot = state.slots[state.selected];
    if (!slot) return;
    var W = preview.width, H = preview.height;
    var r = LAYOUTS[state.layout][state.selected];
    var pw = r.w * W, ph = r.h * H;
    slot.ox = drag.ox + (p.x - drag.x) / pw;
    slot.oy = drag.oy + (p.y - drag.y) / ph;
    renderPreview();
  });
  function endDrag() {
    drag = null;
    preview.classList.remove('dragging');
  }
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);

  // ------------------------------------------------------------- init
  ensureSlots();
  markActive(layoutRow, 'layout', state.layout);
  markActive(gradeRow, 'grade', state.grade);
  markActive(sizeRow, 'size', state.size);
  markActive(posRow, 'pos', state.captionPos);
  syncPanelRow();
  syncZoom();
  renderPreview();

  // Test hook for headless checks: returns a PNG data URL at export size.
  window.__cover = {
    exportPNG: exportPNG,
    state: state,
    renderPreview: renderPreview,
  };
})();
