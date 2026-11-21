/* ==========================================================================
   Song Hỷ Xanh — 100% Exact Demo Interactive Engine
   Matches chungdoi.com/vi/mau-thiep/song-hy-xanh/demo (57034, 65110, 71675, 43637, 11584)
   ========================================================================== */

(() => {
  const ALBUM_PHOTOS = [
    '/data/images/cover-DXD_9823.jpg',
    '/data/images/album/01-DXD_8719.jpg',
    '/data/images/album/02-DXD_8148-1.jpg',
    '/data/images/album/03-DXD_9604.jpg',
    '/data/images/album/04-DXD_7854.jpg',
    '/data/images/album/05-DXD_9846.jpg',
    '/data/images/album/06-DXD_8205.jpg',
    '/data/images/album/07-DXD_8972.jpg',
    '/data/images/album/08-DXD_8587.jpg'
  ];

  const PARTICLE_COLORS = ['#a8e6a3', '#7bc47a', '#4CAF50', '#c8e6c9'];
  const WEDDING_TARGET = new Date('2026-12-20T11:30:00+07:00');
  const STORAGE_WISHES_KEY = 'wedding_wishes_nhotin_hongngan_v3';
  const STORAGE_RSVP_KEY = 'wedding_rsvp_nhotin_hongngan_v3';

  // Clean up old dev localStorage submissions
  try {
    ['wedding_wishes_nhotin_hongngan_v1', 'wedding_wishes_nhotin_hongngan_v2', 'wedding_rsvp_nhotin_hongngan_v1', 'wedding_rsvp_nhotin_hongngan_v2'].forEach((k) => localStorage.removeItem(k));
  } catch (_) {}

  const DEFAULT_WISHES = [];

  /* ==========================================================================
     1. HERO ARCH TWIN STARS (Exact eD algorithm from 71675.js)
     ========================================================================== */
  function closestLengthOnPath(pathEl, x, y) {
    const total = pathEl.getTotalLength();
    let bestLen = 0;
    let bestDist = Infinity;
    for (let i = 0; i <= total; i += 0.5) {
      const pt = pathEl.getPointAtLength(i);
      const d = (pt.x - x) ** 2 + (pt.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestLen = i;
      }
    }
    return bestLen;
  }

  function updateHeroArchStars() {
    const pathEl = document.getElementById('hero-arch-path');
    const textEl = document.getElementById('hero-arch-text');
    const starStart = document.getElementById('hero-star-start');
    const starEnd = document.getElementById('hero-star-end');
    if (!pathEl || !textEl || !starStart || !starEnd) return;

    const isMd = window.matchMedia('(min-width: 768px)').matches;
    const fontSize = isMd ? 18 : 14;
    const starSize = isMd ? 16 : 12;
    const starPathPad = isMd ? 26 : 20;

    const a = 286 / 2;
    const r = a + 0.38 * fontSize;
    pathEl.setAttribute('d', `M ${a - r} ${a} A ${r} ${r} 0 0 1 ${a + r} ${a}`);
    textEl.setAttribute('font-size', String(fontSize));

    try {
      const count = textEl.getNumberOfChars();
      if (count < 1) return;
      const startPos = textEl.getStartPositionOfChar(0);
      const endPos = textEl.getEndPositionOfChar(count - 1);
      const total = pathEl.getTotalLength();
      const lStart = closestLengthOnPath(pathEl, startPos.x, startPos.y);
      const lEnd = closestLengthOnPath(pathEl, endPos.x, endPos.y);
      const mid = total / 2;
      const halfSpan = (lEnd - lStart) / 2;

      const pStart = pathEl.getPointAtLength(Math.max(0, mid - halfSpan - starPathPad));
      const pEnd = pathEl.getPointAtLength(Math.min(total, mid + halfSpan + starPathPad));

      starStart.setAttribute('x', String(pStart.x - starSize / 2));
      starStart.setAttribute('y', String(pStart.y - starSize / 2));
      starStart.setAttribute('width', String(starSize));
      starStart.setAttribute('height', String(starSize));
      starStart.setAttribute('opacity', '0.9');

      starEnd.setAttribute('x', String(pEnd.x - starSize / 2));
      starEnd.setAttribute('y', String(pEnd.y - starSize / 2));
      starEnd.setAttribute('width', String(starSize));
      starEnd.setAttribute('height', String(starSize));
      starEnd.setAttribute('opacity', '0.9');
    } catch (_) {}
  }

  /* ==========================================================================
     2. ENVELOPE COVER & OPENING SEQUENCE (Exact 57034.js eo, el, P="opening"->"away"->"done")
     ========================================================================== */
  const ambientContainer = document.getElementById('ambient-particles');
  const burstContainer = document.getElementById('burst-particles');
  const envelopeRoot = document.getElementById('envelope-root');
  const envelopeAwayWrapper = document.getElementById('envelope-away-wrapper');
  const waxSeal = document.getElementById('wax-seal');
  const sealRing = document.getElementById('seal-ring');
  const envelopeOpenGlow = document.getElementById('envelope-open-glow');
  const flyOnOpenLayer = document.getElementById('fly-on-open-layer');
  const openInviteBtn = document.getElementById('open-invite-btn');
  const bgMusic = document.getElementById('bg-music');

  // Seeded PRNG matching 57034.js FNV-1a + Mulberry32 for 12 ambient rising 囍
  function initAmbientParticles() {
    if (!ambientContainer) return;
    let seed = 0x811c9dc5;
    const key = 'song-hy-xanh:Nho Tín:Hồng Ngân';
    for (let i = 0; i < key.length; i++) {
      seed ^= key.charCodeAt(i);
      seed = Math.imul(seed, 0x1000193);
    }
    seed = seed >>> 0;
    const rand = () => {
      let t = (seed = (seed + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      return (((t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t >>> 14)) >>> 0) / 0x100000000;
    };

    for (let n = 0; n < 20; n++) {
      const dur = 22 + 12 * rand();
      const x = 4 + 92 * rand();
      const color = PARTICLE_COLORS[Math.floor(rand() * PARTICLE_COLORS.length)];
      const size = 14 + 16 * rand();
      const delay = -rand() * dur;
      const sway = Math.round((rand() - 0.5) * 50);

      const div = document.createElement('div');
      div.className = 'jsx-353cb38c53e4a74a absolute';
      div.style.cssText = `left:${x.toFixed(1)}%;top:auto;bottom:-36px;color:${color};font-size:${Math.round(size)}px;font-weight:700;will-change:transform,opacity;--sway:${sway}px;animation:ambient-rise ${dur.toFixed(1)}s ease-in-out ${delay.toFixed(1)}s infinite`;
      div.textContent = '囍';
      ambientContainer.appendChild(div);
    }
  }

  // Exact Web Audio synthesized chime from 57034.js eo()
  function playEnvelopeChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        const start = now + 0.1 * idx;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.035 - 0.005 * idx, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 1.8);
        osc.start(start);
        osc.stop(start + 1.8);
      });

      [1567.98, 2093].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        const start = now + 0.35 + 0.1 * idx;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.015, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
        osc.start(start);
        osc.stop(start + 1.2);
      });

      const padOsc = ctx.createOscillator();
      const padGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      padOsc.connect(filter);
      filter.connect(padGain);
      padGain.connect(ctx.destination);
      padOsc.type = 'sine';
      padOsc.frequency.setValueAtTime(261.63, now);
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      padGain.gain.setValueAtTime(0, now);
      padGain.gain.linearRampToValueAtTime(0.025, now + 0.4);
      padGain.gain.setValueAtTime(0.02, now + 1);
      padGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      padOsc.start(now);
      padOsc.stop(now + 2.5);

      setTimeout(() => {
        [783.99, 987.77, 1174.66, 1567.98].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          const start = ctx.currentTime + 0.06 * idx;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.025, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
          osc.start(start);
          osc.stop(start + 0.6);
        });
      }, 1200);
    } catch (_) {}
  }

  // Radial burst of glowing 囍 on open
  function spawnBurstParticles() {
    if (!burstContainer) return;
    burstContainer.replaceChildren();
    const count = 28;
    for (let t = 0; t < count; t++) {
      const angle = (2 * Math.PI * t) / count + (Math.random() - 0.5) * 0.4;
      const dist = 25 + 60 * Math.random();
      const x = 50 + Math.cos(angle) * dist;
      const y = 50 + Math.sin(angle) * dist;
      const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
      const size = Math.round(12 + 16 * Math.random());
      const rotStart = Math.round((Math.random() - 0.5) * 30);
      const rotEnd = Math.round((Math.random() - 0.5) * 360);
      const delay = (0.15 * Math.random()).toFixed(2);

      const el = document.createElement('div');
      el.className = 'jsx-353cb38c53e4a74a absolute left-1/2 top-1/2';
      el.style.cssText = `color:${color};font-size:${size}px;font-weight:700;will-change:transform,opacity;--dx:${Math.round((x - 50) * 5)}px;--dy:${Math.round((y - 50) * 5)}px;--rot-start:${rotStart}deg;--rot-end:${rotEnd}deg;animation:particle-burst 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s forwards`;
      el.textContent = '囍';
      burstContainer.appendChild(el);
    }
    setTimeout(() => {
      if (burstContainer) burstContainer.replaceChildren();
    }, 1500);
  }

  // Personalized guest name via ?guest=...
  const params = new URLSearchParams(window.location.search);
  const guestName = params.get('guest');
  if (guestName && guestName.trim()) {
    const guestBox = document.getElementById('guest-box');
    const guestText = document.getElementById('guest-name-text');
    if (guestBox && guestText) {
      guestText.textContent = guestName.trim();
      guestBox.classList.remove('hidden');
      guestBox.classList.add('inline-block');
    }
  }

  let envelopeState = 'idle';

  function finishEnvelopeOpen() {
    if (envelopeState === 'done') return;
    envelopeState = 'done';
    if (envelopeRoot) envelopeRoot.remove();
    startCinematicAutoScroll();
    requestAnimationFrame(updateHeroArchStars);
  }

  if (params.get('open') === '1') {
    finishEnvelopeOpen();
  }

  function triggerEnvelopeOpen(e) {
    if (e) e.preventDefault();
    if (envelopeState !== 'idle') return;
    envelopeState = 'opening';
    if (openInviteBtn) openInviteBtn.setAttribute('aria-busy', 'true');

    // Start music & synthesized chime
    playEnvelopeChime();
    startMusicPlayback();

    // 0ms ("opening"): Seal break + expanding ring + radial glow + flying chu-hy
    if (waxSeal) {
      waxSeal.style.animation = 'seal-break 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    }
    if (sealRing) sealRing.classList.remove('hidden');
    if (envelopeOpenGlow) envelopeOpenGlow.classList.remove('hidden');
    const staticTl = document.getElementById('static-chu-hy-tl');
    const staticBr = document.getElementById('static-chu-hy-br');
    if (staticTl) staticTl.classList.add('hidden');
    if (staticBr) staticBr.classList.add('hidden');
    if (flyOnOpenLayer) flyOnOpenLayer.classList.remove('hidden');

    // 500ms ("away"): 32 particle burst + envelope shoots up -120vh
    setTimeout(() => {
      envelopeState = 'away';
      spawnBurstParticles();
      if (envelopeAwayWrapper) {
        envelopeAwayWrapper.style.animation = 'envelope-away 0.8s ease-in forwards';
      }
    }, 500);

    // 1300ms ("done"): Unmount envelope
    setTimeout(() => {
      finishEnvelopeOpen();
    }, 1300);
  }

  if (openInviteBtn) {
    openInviteBtn.addEventListener('click', triggerEnvelopeOpen);
  }
  if (waxSeal) {
    waxSeal.addEventListener('click', triggerEnvelopeOpen);
  }

  /* ==========================================================================
     3. FLOATING MUSIC PLAYER & ROMANTIC TRACK SWITCHER
     ========================================================================== */
  const ROMANTIC_TRACKS = [
    {
      id: 'mot-doi',
      title: 'Một Đời',
      artist: '14 Casper & Bon Nghiêm (Nhạc mẫu Song Hỷ Xanh)',
      src: '/data/audio/mot-doi.mp3'
    },
    {
      id: 'tinh-chenh-pho',
      title: 'Tình Chênh Phô (Tâm Sự 3)',
      artist: 'Trúc Nhân (Album Tân Mùi)',
      src: '/data/audio/tinh-chenh-pho.mp3'
    },
    {
      id: 'cant-help-falling-in-love',
      title: "Can't Help Falling In Love",
      artist: 'Kina Grannis (Acoustic nhẹ nhàng)',
      src: '/data/audio/cant-help-falling-in-love.mp3'
    },
    {
      id: 'beautiful-in-white-strings',
      title: 'Beautiful In White × Canon in D',
      artist: 'FourScore (Hòa tấu Violin & Cello)',
      src: '/data/audio/beautiful-in-white-strings.mp3'
    },
    {
      id: 'le-duong',
      title: 'Lễ Đường',
      artist: 'Kai Đinh (Ballad sâu lắng)',
      src: '/data/audio/le-duong.mp3'
    },
    {
      id: 'beautiful-in-white',
      title: 'Beautiful In White',
      artist: 'Shane Filan',
      src: '/data/audio/beautiful-in-white.mp3'
    },
    {
      id: 'em-dong-y-i-do',
      title: 'Em Đồng Ý (I Do)',
      artist: 'Đức Phúc × 911',
      src: '/data/audio/em-dong-y-i-do.mp3'
    }
  ];

  const STORAGE_MUSIC_KEY = 'wedding_music_track_nhotin_hongngan_v1';
  const musicToggleBtn = document.getElementById('music-toggle-btn');
  const musicCdDisc = document.getElementById('music-cd-disc');
  const musicBars = document.getElementById('music-bars');
  const musicNoteIcon = document.getElementById('music-note-icon');
  const musicPing = document.getElementById('music-ping');
  const musicTooltip = document.getElementById('music-tooltip');
  const openMusicPickerBtn = document.getElementById('open-music-picker-btn');
  const closeMusicPickerBtn = document.getElementById('close-music-picker');
  const musicPickerPanel = document.getElementById('music-picker-panel');
  const musicTrackList = document.getElementById('music-track-list');
  const currentTrackLabel = document.getElementById('current-track-label');

  let currentTrackId = localStorage.getItem(STORAGE_MUSIC_KEY) || 'mot-doi';
  if (!ROMANTIC_TRACKS.some((t) => t.id === currentTrackId)) {
    currentTrackId = 'mot-doi';
  }

  function applyTrack(trackId, autoPlay = false) {
    const track = ROMANTIC_TRACKS.find((t) => t.id === trackId) || ROMANTIC_TRACKS[0];
    currentTrackId = track.id;
    try { localStorage.setItem(STORAGE_MUSIC_KEY, currentTrackId); } catch (_) {}
    if (currentTrackLabel) currentTrackLabel.textContent = track.title;
    if (bgMusic && !bgMusic.src.endsWith(track.src)) {
      bgMusic.src = track.src;
      bgMusic.load();
    }
    renderMusicTrackList();
    if (autoPlay) startMusicPlayback();
  }

  function renderMusicTrackList() {
    if (!musicTrackList) return;
    musicTrackList.replaceChildren();
    ROMANTIC_TRACKS.forEach((track) => {
      const isSelected = track.id === currentTrackId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-full text-left px-2.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-2 ${
        isSelected ? 'font-semibold' : 'hover:bg-black/5'
      }`;
      btn.style.backgroundColor = isSelected ? 'rgba(31,58,37,0.12)' : '';

      const meta = document.createElement('div');
      meta.className = 'min-w-0 flex-1';

      const titleEl = document.createElement('div');
      titleEl.className = 'truncate text-xs';
      titleEl.style.color = '#1F3A25';
      titleEl.textContent = track.title;

      const artistEl = document.createElement('div');
      artistEl.className = 'truncate text-[10px] opacity-70';
      artistEl.textContent = track.artist;

      meta.appendChild(titleEl);
      meta.appendChild(artistEl);

      const indicator = document.createElement('span');
      indicator.className = 'text-xs';
      indicator.textContent = isSelected ? '♪' : '';

      btn.appendChild(meta);
      btn.appendChild(indicator);
      btn.addEventListener('click', () => {
        applyTrack(track.id, true);
        musicPickerPanel?.classList.add('hidden');
      });
      musicTrackList.appendChild(btn);
    });
  }

  applyTrack(currentTrackId, false);

  openMusicPickerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    musicPickerPanel?.classList.toggle('hidden');
  });

  closeMusicPickerBtn?.addEventListener('click', () => {
    musicPickerPanel?.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (musicPickerPanel && !musicPickerPanel.classList.contains('hidden')) {
      if (!e.target.closest('#music-player-root')) {
        musicPickerPanel.classList.add('hidden');
      }
    }
  });

  function syncMusicUI(playing, showPrompt = false) {
    if (musicCdDisc) musicCdDisc.classList.toggle('animate-spin-cd', playing);
    if (musicBars) musicBars.classList.toggle('hidden', !playing);
    if (musicNoteIcon) musicNoteIcon.classList.toggle('hidden', playing);
    if (musicPing) musicPing.classList.toggle('hidden', playing || !showPrompt);
    if (musicTooltip) musicTooltip.classList.toggle('hidden', playing || !showPrompt);
  }

  function startMusicPlayback() {
    if (!bgMusic) return;
    bgMusic.volume = 0.5;
    const p = bgMusic.play();
    if (p && typeof p.then === 'function') {
      p.then(() => syncMusicUI(true, false)).catch(() => {
        syncMusicUI(false, true);
        setTimeout(() => {
          if (musicTooltip) musicTooltip.classList.add('hidden');
        }, 5000);
      });
    }
  }

  if (bgMusic) {
    bgMusic.addEventListener('playing', () => syncMusicUI(true, false));
    bgMusic.addEventListener('pause', () => syncMusicUI(false, false));
  }

  if (musicToggleBtn && bgMusic) {
    musicToggleBtn.addEventListener('click', () => {
      if (bgMusic.paused) {
        startMusicPlayback();
      } else {
        bgMusic.pause();
      }
    });
  }

  /* ==========================================================================
     4. CINEMATIC AUTO-SCROLL (Exact 60193.js behavior)
     ========================================================================== */
  const scrollSpeedParam = parseInt(params.get('scroll') || '50', 10);
  const AUTO_SCROLL_SPEED = !isNaN(scrollSpeedParam) && scrollSpeedParam > 0 ? scrollSpeedParam : 50;
  let autoScrollActive = false;
  let autoScrollPaused = false;
  let autoScrollRaf = null;
  let autoScrollTimer = null;
  let lastFrameTs = null;
  let currentScrollY = 0;
  let wheelDeltaAccum = 0;

  function stepAutoScroll(ts) {
    if (!autoScrollActive || autoScrollPaused) {
      autoScrollRaf = null;
      return;
    }
    if (lastFrameTs === null) {
      lastFrameTs = ts;
      currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    }
    const dt = Math.min(ts - lastFrameTs, 100);
    lastFrameTs = ts;

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (maxScroll <= 10 || currentScrollY >= maxScroll - 0.5) {
      autoScrollPaused = true;
      autoScrollRaf = null;
      return;
    }

    currentScrollY = Math.min(currentScrollY + (dt / 1000) * AUTO_SCROLL_SPEED, maxScroll);
    window.scrollTo(0, currentScrollY);
    autoScrollRaf = requestAnimationFrame(stepAutoScroll);
  }

  function startCinematicAutoScroll() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.scrollTo(0, 0);
    autoScrollActive = true;
    autoScrollPaused = false;
    clearTimeout(autoScrollTimer);
    autoScrollTimer = setTimeout(() => {
      if (!autoScrollPaused) {
        lastFrameTs = null;
        autoScrollRaf = requestAnimationFrame(stepAutoScroll);
      }
    }, 2000);
  }

  function pauseAutoScroll() {
    autoScrollPaused = true;
    clearTimeout(autoScrollTimer);
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  }

  function resumeAutoScroll() {
    if (!autoScrollActive) return;
    autoScrollPaused = false;
    lastFrameTs = null;
    if (!autoScrollRaf) {
      autoScrollRaf = requestAnimationFrame(stepAutoScroll);
    }
  }

  window.addEventListener('wheel', (e) => {
    if (!autoScrollActive || autoScrollPaused) return;
    wheelDeltaAccum += Math.abs(e.deltaY);
    if (wheelDeltaAccum >= 50) {
      wheelDeltaAccum = 0;
      pauseAutoScroll();
    }
  }, { passive: true });

  window.addEventListener('touchmove', () => {
    if (autoScrollActive && !autoScrollPaused) pauseAutoScroll();
  }, { passive: true });

  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches('input, textarea, select')) pauseAutoScroll();
  });

  const inviteRenderer = document.getElementById('invite-renderer');
  if (inviteRenderer) {
    inviteRenderer.addEventListener('click', (e) => {
      if (!autoScrollActive) return;
      if (e.target.closest('img, button, a, input, textarea, select, iframe, dialog')) return;
      if (autoScrollPaused) resumeAutoScroll();
      else pauseAutoScroll();
    });
  }

  /* ==========================================================================
     5. 3D COVERFLOW ALBUM & DAISYUI LIGHTBOX (Exact 71675.js & 34262.js)
     ========================================================================== */
  const coverflowStage = document.getElementById('coverflow-stage');
  const coverflowTrack = document.getElementById('coverflow-track');
  const albumDots = document.getElementById('album-dots');
  const lightboxDialog = document.getElementById('lightbox-dialog');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const lightboxThumbs = document.getElementById('lightbox-thumbs');

  let activeSlide = 0;
  let albumTimer = null;
  let userHoldTimer = null;
  let isAlbumIntersecting = true;
  let lightboxIdx = 0;

  function buildAlbumAndLightbox() {
    ALBUM_PHOTOS.forEach((src, idx) => {
      // Coverflow slide
      const slide = document.createElement('div');
      slide.className = 'absolute h-[92%] rounded-2xl overflow-hidden shadow-xl cursor-pointer transition-all ease-in-out';
      slide.style.aspectRatio = '0.6666666666666666';
      slide.style.transitionDuration = '1100ms';
      const slideImg = document.createElement('img');
      slideImg.alt = `Wedding photo ${idx + 1}`;
      slideImg.className = 'h-full w-full object-cover';
      slideImg.src = src;
      slideImg.style.objectPosition = '50% 50%';
      slide.appendChild(slideImg);
      slide.addEventListener('click', () => {
        if (idx === activeSlide) {
          openLightbox(idx);
        } else {
          selectSlide(idx, true);
        }
      });
      coverflowTrack.appendChild(slide);

      // Dot
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to photo ${idx + 1}`);
      dot.addEventListener('click', () => selectSlide(idx, true));
      albumDots.appendChild(dot);

      // Lightbox thumb
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.setAttribute('aria-label', `View image ${idx + 1}`);
      const thumbImg = document.createElement('img');
      thumbImg.alt = `Thumbnail ${idx + 1}`;
      thumbImg.className = 'h-full w-full object-cover';
      thumbImg.draggable = false;
      thumbImg.src = src;
      thumb.appendChild(thumbImg);
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        updateLightboxSlide(idx);
      });
      lightboxThumbs.appendChild(thumb);
    });

    renderCoverflow();

    if ('IntersectionObserver' in window && coverflowStage) {
      const obs = new IntersectionObserver(
        (entries) => {
          isAlbumIntersecting = entries[0].isIntersecting;
          if (isAlbumIntersecting) startAlbumAutoPlay();
          else clearInterval(albumTimer);
        },
        { threshold: 0, rootMargin: '300px 0px' }
      );
      obs.observe(coverflowStage);
    }

    startAlbumAutoPlay();
  }

  function renderCoverflow() {
    const slides = coverflowTrack.children;
    const dots = albumDots.children;
    const total = ALBUM_PHOTOS.length;

    for (let idx = 0; idx < total; idx++) {
      const slide = slides[idx];
      let diff = idx - activeSlide;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      const abs = Math.abs(diff);
      const tx = diff * 60;
      const tz = -abs * 150;
      const ry = diff * 45;
      const scale = abs === 0 ? 1 : abs === 1 ? 0.85 : 0.7;
      const opacity = abs === 0 ? 1 : abs === 1 ? 0.75 : abs === 2 ? 0.5 : abs === 3 ? 0.3 : 0;
      const zIndex = 100 - abs;

      slide.style.transform = `translateX(${tx}%) translateZ(${tz}px) rotateY(${ry}deg) scale(${scale})`;
      slide.style.opacity = String(opacity);
      slide.style.zIndex = String(zIndex);
      slide.style.pointerEvents = abs <= 2 ? 'auto' : 'none';
      slide.classList.toggle('ring-2', abs === 0);
      slide.classList.toggle('ring-white/30', abs === 0);

      const dot = dots[idx];
      if (dot) {
        dot.className =
          idx === activeSlide
            ? 'rounded-full transition-all duration-300 w-6 h-2 bg-current opacity-70'
            : 'rounded-full transition-all duration-300 w-2 h-2 bg-current opacity-25 hover:opacity-40';
      }
    }
  }

  function selectSlide(idx, byUser = false) {
    const total = ALBUM_PHOTOS.length;
    activeSlide = ((idx % total) + total) % total;
    renderCoverflow();
    if (byUser) {
      clearInterval(albumTimer);
      clearTimeout(userHoldTimer);
      userHoldTimer = setTimeout(() => {
        if (isAlbumIntersecting) startAlbumAutoPlay();
      }, 6000);
    }
  }

  function startAlbumAutoPlay() {
    clearInterval(albumTimer);
    if (!isAlbumIntersecting || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    albumTimer = setInterval(() => {
      activeSlide = (activeSlide + 1) % ALBUM_PHOTOS.length;
      renderCoverflow();
    }, 1400);
  }

  document.getElementById('album-prev')?.addEventListener('click', () => selectSlide(activeSlide - 1, true));
  document.getElementById('album-next')?.addEventListener('click', () => selectSlide(activeSlide + 1, true));

  let touchStart = null;
  coverflowStage?.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  coverflowStage?.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.y);
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > dy) {
      selectSlide(dx < 0 ? activeSlide + 1 : activeSlide - 1, true);
    }
  }, { passive: true });

  function updateLightboxSlide(idx) {
    const total = ALBUM_PHOTOS.length;
    lightboxIdx = ((idx % total) + total) % total;
    if (lightboxImg) lightboxImg.src = ALBUM_PHOTOS[lightboxIdx];
    if (lightboxCounter) lightboxCounter.textContent = `${lightboxIdx + 1} / ${total}`;
    Array.from(lightboxThumbs.children).forEach((btn, i) => {
      const isCurrent = i === lightboxIdx;
      btn.setAttribute('aria-current', isCurrent ? 'true' : 'false');
      btn.className = isCurrent
        ? 'flex-shrink-0 h-12 w-12 sm:h-16 sm:w-16 rounded-md sm:rounded-lg overflow-hidden transition-all duration-200 scale-105 shadow-lg'
        : 'flex-shrink-0 h-12 w-12 sm:h-16 sm:w-16 rounded-md sm:rounded-lg overflow-hidden transition-all duration-200 opacity-60 hover:opacity-100';
      btn.style.outline = isCurrent ? '2px solid #1F3A25' : '';
      btn.style.outlineOffset = isCurrent ? '2px' : '';
    });
  }

  function openLightbox(idx) {
    updateLightboxSlide(idx);
    clearInterval(albumTimer);
    lightboxDialog?.showModal();
  }

  lightboxDialog?.addEventListener('close', () => {
    startAlbumAutoPlay();
  });

  document.getElementById('lightbox-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateLightboxSlide(lightboxIdx - 1);
  });
  document.getElementById('lightbox-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateLightboxSlide(lightboxIdx + 1);
  });

  /* ==========================================================================
     6. COUNTDOWN & DECEMBER 2026 CALENDAR
     ========================================================================== */
  const countdownEl = document.getElementById('countdown-display');
  function updateCountdown() {
    if (!countdownEl) return;
    const diff = WEDDING_TARGET.getTime() - Date.now();
    if (diff <= 0) {
      countdownEl.textContent = 'Đám cưới đã diễn ra!';
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    countdownEl.textContent = `${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`;
  }

  function buildCalendar() {
    const grid = document.getElementById('calendar-days');
    if (!grid) return;
    // Dec 1, 2026 is Tuesday (1 empty slot for Monday T2)
    const blank = document.createElement('div');
    blank.className = 'flex items-center justify-center h-[30px] md:h-[34px]';
    grid.appendChild(blank);

    for (let d = 1; d <= 31; d++) {
      const cell = document.createElement('div');
      cell.className = 'flex items-center justify-center h-[30px] md:h-[34px]';
      if (d === 20) {
        const wrap = document.createElement('div');
        wrap.className = 'relative w-[26px] h-[24px] md:w-[30px] md:h-[28px] flex items-center justify-center';
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'absolute inset-0 w-full h-full drop-shadow-sm');
        svg.setAttribute('fill', '#1F3A25');
        svg.setAttribute('viewBox', '0 0 24 22');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M12 21C12 21 1.5 13.5 1.5 7.5C1.5 4.46 3.96 2 7 2C8.76 2 10.35 2.81 11.4 4.09L12 4.8L12.6 4.09C13.65 2.81 15.24 2 17 2C20.04 2 22.5 4.46 22.5 7.5C22.5 13.5 12 21 12 21Z');
        svg.appendChild(path);
        const dayNum = document.createElement('span');
        dayNum.className = 'relative z-10 text-[11px] md:text-[12px] font-bold';
        dayNum.style.color = '#fff';
        dayNum.textContent = '20';
        wrap.appendChild(svg);
        wrap.appendChild(dayNum);
        cell.appendChild(wrap);
      } else {
        const span = document.createElement('span');
        span.className = 'text-[12px] md:text-[13px]';
        span.textContent = String(d);
        cell.appendChild(span);
      }
      grid.appendChild(cell);
    }
  }

  /* ==========================================================================
     7. GUESTBOOK
     ========================================================================== */
  const wishesListEl = document.getElementById('wishes-list');
  const wishForm = document.getElementById('guestbook-form');
  const wishNameInput = document.getElementById('wish-name');
  const wishMsgInput = document.getElementById('wish-message');

  function loadWishes() {
    try {
      const raw = localStorage.getItem(STORAGE_WISHES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_WISHES;
  }

  function saveWishes(list) {
    try { localStorage.setItem(STORAGE_WISHES_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function renderWishes(listOpt) {
    if (!wishesListEl) return;
    const list = Array.isArray(listOpt) ? listOpt : loadWishes();
    wishesListEl.replaceChildren();
    list.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-lg p-4 shadow-md border border-gray-100';

      const header = document.createElement('div');
      header.className = 'flex items-start justify-between';

      const nameEl = document.createElement('span');
      nameEl.className = 'text-lg';
      nameEl.style.color = '#1F3A25';
      nameEl.style.fontFamily = "'Times New Roman', ChungDoiIndic, serif";
      nameEl.textContent = String(w.name || '');

      const timeEl = document.createElement('span');
      timeEl.className = 'text-xs opacity-70';
      timeEl.textContent = String(w.time || '');

      header.appendChild(nameEl);
      header.appendChild(timeEl);

      const msgEl = document.createElement('p');
      msgEl.className = 'mt-2 leading-relaxed';
      msgEl.textContent = String(w.message || '');

      card.appendChild(header);
      card.appendChild(msgEl);
      wishesListEl.appendChild(card);
    });
  }

  async function fetchWishesFromServer() {
    try {
      const res = await fetch('/api/wishes', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.wishes)) {
        saveWishes(data.wishes);
        renderWishes(data.wishes);
      }
    } catch (_) {}
  }

  wishForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = wishNameInput.value.trim();
    const message = wishMsgInput.value.trim();
    if (!name || !message) return;

    const now = new Date();
    const fallbackTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const submitBtn = wishForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    let savedOnServer = false;
    let rateLimited = false;
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message })
      });
      if (res.status === 429) {
        rateLimited = true;
      } else if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.wishes)) {
          saveWishes(data.wishes);
          renderWishes(data.wishes);
          savedOnServer = true;
        }
      }
    } catch (_) {}

    if (!savedOnServer && !rateLimited) {
      const list = loadWishes();
      list.unshift({ name, message, time: fallbackTime });
      saveWishes(list);
      renderWishes(list);
    }

    if (submitBtn) submitBtn.disabled = false;
    if (!rateLimited) {
      wishNameInput.value = '';
      wishMsgInput.value = '';
    }
  });

  /* ==========================================================================
     8. GIFTBOX MODAL & COPY STK
     ========================================================================== */
  const openGiftboxBtn = document.getElementById('open-giftbox-btn');
  const giftboxDialog = document.getElementById('giftbox-dialog');
  const copyAccountBtn = document.getElementById('copy-account-btn');

  openGiftboxBtn?.addEventListener('click', () => {
    giftboxDialog?.showModal();
  });

  copyAccountBtn?.addEventListener('click', () => {
    navigator.clipboard?.writeText('07559711813').then(() => {
      const orig = copyAccountBtn.textContent;
      copyAccountBtn.textContent = '✓ Đã sao chép';
      setTimeout(() => {
        copyAccountBtn.textContent = orig;
      }, 2000);
    });
  });

  /* ==========================================================================
     9. RSVP DIALOG (Exact 11584.js interaction)
     ========================================================================== */
  const openRsvpBtn = document.getElementById('open-rsvp-btn');
  const rsvpDialog = document.getElementById('rsvp-dialog');
  const rsvpFormContainer = document.getElementById('rsvp-form-container');
  const rsvpThankyouContainer = document.getElementById('rsvp-thankyou-container');
  const rsvpForm = document.getElementById('rsvp-form');
  const rsvpYesCard = document.getElementById('rsvp-yes-card');
  const rsvpNoCard = document.getElementById('rsvp-no-card');
  const rsvpYesBadge = document.getElementById('rsvp-yes-badge');
  const rsvpNoBadge = document.getElementById('rsvp-no-badge');
  const rsvpYesSvg = document.getElementById('rsvp-yes-svg');
  const rsvpNoSvg = document.getElementById('rsvp-no-svg');
  const rsvpYesLabel = document.getElementById('rsvp-yes-label');
  const rsvpNoLabel = document.getElementById('rsvp-no-label');
  const rsvpGuestCountRow = document.getElementById('rsvp-guest-count-row');
  const rsvpGuestCountEl = document.getElementById('rsvp-guest-count');
  const rsvpMinusBtn = document.getElementById('rsvp-minus-btn');
  const rsvpPlusBtn = document.getElementById('rsvp-plus-btn');

  let rsvpCount = 1;
  let rsvpAttending = 'yes';

  function updateRsvpAttendanceUI(val) {
    rsvpAttending = val;
    const isYes = val === 'yes';

    if (rsvpYesCard) {
      rsvpYesCard.className = `flex items-center gap-3 py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
        isYes ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
      }`;
    }
    if (rsvpYesBadge) rsvpYesBadge.className = `w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isYes ? 'bg-emerald-500' : 'bg-gray-200'}`;
    if (rsvpYesSvg) rsvpYesSvg.setAttribute('class', `w-4 h-4 ${isYes ? 'text-white' : 'text-gray-500'}`);
    if (rsvpYesLabel) rsvpYesLabel.className = `text-sm font-medium ${isYes ? 'text-emerald-700' : 'text-gray-700'}`;

    if (rsvpNoCard) {
      rsvpNoCard.className = `flex items-center gap-3 py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
        !isYes ? 'border-red-400 bg-red-50/50' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
      }`;
    }
    if (rsvpNoBadge) rsvpNoBadge.className = `w-8 h-8 rounded-full flex items-center justify-center transition-colors ${!isYes ? 'bg-red-400' : 'bg-gray-200'}`;
    if (rsvpNoSvg) rsvpNoSvg.setAttribute('class', `w-4 h-4 ${!isYes ? 'text-white' : 'text-gray-500'}`);
    if (rsvpNoLabel) rsvpNoLabel.className = `text-sm font-medium ${!isYes ? 'text-red-600' : 'text-gray-700'}`;

    if (rsvpGuestCountRow) rsvpGuestCountRow.classList.toggle('hidden', !isYes);
  }

  rsvpForm?.querySelectorAll('input[name="attending"]').forEach((radio) => {
    radio.addEventListener('change', (e) => updateRsvpAttendanceUI(e.target.value));
  });

  rsvpMinusBtn?.addEventListener('click', () => {
    rsvpCount = Math.max(1, rsvpCount - 1);
    if (rsvpGuestCountEl) rsvpGuestCountEl.textContent = String(rsvpCount);
  });

  rsvpPlusBtn?.addEventListener('click', () => {
    rsvpCount = Math.min(10, rsvpCount + 1);
    if (rsvpGuestCountEl) rsvpGuestCountEl.textContent = String(rsvpCount);
  });

  openRsvpBtn?.addEventListener('click', () => {
    rsvpFormContainer?.classList.remove('hidden');
    rsvpThankyouContainer?.classList.add('hidden');
    rsvpDialog?.showModal();
  });

  rsvpForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('rsvp-name').value.trim();
    const note = document.getElementById('rsvp-note').value.trim();
    if (!name) return;

    const currentAttending = rsvpAttending;
    const currentGuests = rsvpCount;
    const submitBtn = rsvpForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await fetch('/api/rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          attending: currentAttending,
          guests: currentGuests,
          note
        })
      });
    } catch (_) {}

    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_RSVP_KEY) || '[]');
      list.push({ name, attending: currentAttending, guests: currentGuests, note, time: new Date().toISOString() });
      localStorage.setItem(STORAGE_RSVP_KEY, JSON.stringify(list));
    } catch (_) {}

    if (submitBtn) submitBtn.disabled = false;

    const msgEl = document.getElementById('rsvp-thankyou-msg');
    if (msgEl) {
      msgEl.replaceChildren();
      const p1 = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = name;
      const p2 = document.createElement('p');

      if (currentAttending === 'yes') {
        p1.append('Đã ghi nhận xác nhận tham dự của ', strong, ` (${currentGuests} khách).`);
        p2.textContent = 'Rất mong được đón tiếp bạn tại buổi tiệc!';
      } else {
        p1.append('Cảm ơn ', strong, ' đã phản hồi.');
        p2.textContent = 'Gia đình rất trân quý tình cảm của bạn!';
      }
      msgEl.appendChild(p1);
      msgEl.appendChild(p2);
    }

    rsvpFormContainer?.classList.add('hidden');
    rsvpThankyouContainer?.classList.remove('hidden');
    rsvpForm.reset();
    rsvpCount = 1;
    if (rsvpGuestCountEl) rsvpGuestCountEl.textContent = '1';
    updateRsvpAttendanceUI('yes');
  });

  /* ==========================================================================
     10. EXACT AUTO-FIT FONT SIZING (Module 20376 + 71675 eA + 35490 p.GT)
     ========================================================================== */
  function measureTextPx(text, sizePx, fontStyle) {
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'nowrap';
    span.style.fontSize = `${sizePx}px`;
    span.style.fontFamily = fontStyle.fontFamily || 'ui-serif, Georgia, Cambria, "Times New Roman", Times, ChungDoiIndic, serif';
    if (fontStyle.fontWeight !== undefined) span.style.fontWeight = String(fontStyle.fontWeight);
    if (fontStyle.letterSpacing !== undefined) span.style.letterSpacing = fontStyle.letterSpacing;
    span.textContent = text;
    document.body.appendChild(span);
    const w = span.offsetWidth;
    document.body.removeChild(span);
    return w;
  }

  function computeAutoFitSize(text, mobileBase, desktopBase, containerEl, fontStyle, opts = {}) {
    const isMd = window.innerWidth >= 768;
    const base = isMd ? desktopBase : mobileBase;
    if (!text || !containerEl) return base;
    const cw = containerEl.offsetWidth;
    if (cw === 0) return base;
    const minSize = opts.minSize ?? Math.max(12, 0.5 * base);
    const widthScale = opts.widthScale ?? 1;
    const fitPadding = opts.fitPadding ?? 0.95;
    const targetW = cw * widthScale;

    let measured = measureTextPx(text, base, fontStyle);
    let est = base;
    if (measured > targetW) {
      est = (targetW / measured) * base * fitPadding;
      est = Math.max(minSize, Math.min(base, est));
    }
    let size = Math.round(est);
    let curW = measureTextPx(text, size, fontStyle);
    if (curW > targetW && size > minSize) {
      size = Math.max(minSize, Math.round((targetW / curW) * size * fitPadding));
      curW = measureTextPx(text, size, fontStyle);
      if (curW > targetW && size > minSize) {
        size = Math.max(minSize, Math.floor((targetW / curW) * size * fitPadding));
      }
    }
    while (size > minSize && measureTextPx(text, size, fontStyle) > targetW) {
      size -= 1;
    }
    return size;
  }

  function updateAutoFitTypography() {
    // 1. Couple Full Names in Ceremony (eA in 71675: mobile 40px, desktop 64px, EB Garamond)
    const groomFullEl = document.getElementById('groom-fullname');
    const brideFullEl = document.getElementById('bride-fullname');
    if (groomFullEl && brideFullEl) {
      const styleCfg = { fontFamily: '"EB Garamond", serif' };
      const optsCfg = { minSize: 24, widthScale: 1, fitPadding: 0.95 };
      const s1 = computeAutoFitSize(groomFullEl.textContent.trim(), 40, 64, groomFullEl, styleCfg, optsCfg);
      const s2 = computeAutoFitSize(brideFullEl.textContent.trim(), 40, 64, brideFullEl, styleCfg, optsCfg);
      const finalFullSize = Math.min(s1, s2);
      groomFullEl.style.fontSize = `${finalFullSize}px`;
      brideFullEl.style.fontSize = `${finalFullSize}px`;
    }

    // 2. Parents' names (p.GT in 35490: mobile 14px, desktop 15px, Baskerville 600)
    const parentEls = document.querySelectorAll('.grid-rows-subgrid > span.font-semibold');
    if (parentEls.length > 0) {
      const pSize = window.innerWidth >= 768 ? 15 : 14;
      parentEls.forEach((el) => {
        el.style.fontSize = `${pSize}px`;
      });
    }
  }

  /* ==========================================================================
     INIT
     ========================================================================== */
  initAmbientParticles();
  buildAlbumAndLightbox();
  buildCalendar();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  renderWishes();
  fetchWishesFromServer();

  updateHeroArchStars();
  updateAutoFitTypography();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      updateHeroArchStars();
      updateAutoFitTypography();
    });
  }
  window.addEventListener('resize', () => {
    updateHeroArchStars();
    updateAutoFitTypography();
  });
})();
