/**
 * ============================================================
 *  NIKE – CHEETAH SCROLLYTELLING ENGINE
 *  TigerExperience Class (ES6+, Vanilla JS)
 * ============================================================
 */

class TigerExperience {
    constructor() {
        // ── Config ─────────────────────────────────────────────
        this.TOTAL_FRAMES = 242;  // confirmed - 242 frames in assests folder
        this.FRAME_PATH = 'assests/Nike trigger image/ezgif-frame-';
        this.FRAME_EXT = '.jpg';

        // ── State ──────────────────────────────────────────────
        this.frames = [];
        this.currentFrame = 0;
        this.loadedCount = 0;
        this.isReady = false;
        this.rafId = null;
        this._resizeTimer = null;

        // ── DOM refs ───────────────────────────────────────────
        this.heroEl = document.getElementById('hero');
        this.stickyEl = document.getElementById('hero-sticky');
        this.fgCanvas = document.getElementById('tiger-canvas');
        this.bgCanvas = document.getElementById('ambient-canvas');
        this.fgCtx = this.fgCanvas.getContext('2d');
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.loaderEl = document.getElementById('hero-loader');
        this.loaderBarEl = document.getElementById('hero-loader-bar');
        this.loaderTextEl = document.getElementById('hero-loader-text');

        // ── Bind ───────────────────────────────────────────────
        this._onResize = this._onResize.bind(this);

        // ── Boot ───────────────────────────────────────────────
        this.initCanvases();
        this.preloadFrames();
        this.initLenis();
        this.initCarousel();
        this.initRevealAnimations();
        this.initNav();

        window.addEventListener('resize', this._onResize);
    }

    /* ──────────────────────────────────────────────────────────
       CANVAS SETUP
    ────────────────────────────────────────────────────────── */
    initCanvases() {
        this._resizeCanvases();
    }

    _resizeCanvases() {
        const W = window.innerWidth;
        const H = window.innerHeight;

        // Foreground – same as viewport
        this.fgCanvas.width = W;
        this.fgCanvas.height = H;

        // Ambient – 110% of viewport (prevents bleed edges)
        this.bgCanvas.width = Math.round(W * 1.1);
        this.bgCanvas.height = Math.round(H * 1.1);

        // Redraw current frame after resize
        if (this.isReady && this.frames[this.currentFrame]) {
            this.drawFrame(this.currentFrame);
        }
    }

    _onResize() {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this._resizeCanvases(), 200);
    }

    /* ──────────────────────────────────────────────────────────
       FRAME PRELOADING
    ────────────────────────────────────────────────────────── */
    preloadFrames() {
        // Determine actual frame count by attempting to load them
        const frameNumbers = [];
        for (let i = 1; i <= this.TOTAL_FRAMES; i++) {
            frameNumbers.push(i);
        }

        let loaded = 0;
        const total = frameNumbers.length;

        frameNumbers.forEach((num) => {
            const img = new Image();
            const padded = String(num).padStart(3, '0');
            img.src = `${this.FRAME_PATH}${padded}${this.FRAME_EXT}`;
            img.decoding = 'async';

            const onDone = () => {
                loaded++;
                this.loadedCount = loaded;
                this.frames[num - 1] = img;

                // Update loader UI
                const pct = Math.round((loaded / total) * 100);
                this._updateLoader(pct);

                // When all frames ready
                if (loaded === total) {
                    this._onAllFramesLoaded();
                }
            };

            img.onload = onDone;
            img.onerror = onDone; // count errors too so we don't hang
        });
    }

    _updateLoader(pct) {
        if (!this.loaderEl) return;
        this.loaderBarEl.style.setProperty('--progress', `${pct}%`);
        this.loaderTextEl.textContent = `Loading ${pct}%`;

        // Update aria
        this.loaderEl.setAttribute('aria-valuenow', pct);
    }

    _onAllFramesLoaded() {
        this.isReady = true;

        // Draw first frame immediately
        this.drawFrame(0);

        // Hide loader
        if (this.loaderEl) {
            this.loaderEl.classList.add('hidden');
        }

        // Wire up GSAP ScrollTrigger
        this.initScrollTrigger();
    }

    /* ──────────────────────────────────────────────────────────
       FRAME RENDERING (dual-canvas)
    ────────────────────────────────────────────────────────── */
    drawFrame(index) {
        const img = this.frames[index];
        if (!img || !img.complete || !img.naturalWidth) return;

        this._drawContain(this.fgCtx, img, this.fgCanvas.width, this.fgCanvas.height);
        this._drawCover(this.bgCtx, img, this.bgCanvas.width, this.bgCanvas.height);
    }

    /** Draw image in "object-fit: contain" mode onto a canvas context */
    _drawContain(ctx, img, cW, cH) {
        ctx.clearRect(0, 0, cW, cH);

        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvRatio = cW / cH;

        let dW, dH, dx, dy;

        if (imgRatio > canvRatio) {
            // Wider than canvas – fit width
            dW = cW;
            dH = cW / imgRatio;
        } else {
            // Taller than canvas – fit height
            dH = cH;
            dW = cH * imgRatio;
        }

        dx = (cW - dW) / 2;
        dy = (cH - dH) / 2;

        ctx.drawImage(img, dx, dy, dW, dH);
    }

    /** Draw image in "object-fit: cover" mode onto a canvas context */
    _drawCover(ctx, img, cW, cH) {
        ctx.clearRect(0, 0, cW, cH);

        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvRatio = cW / cH;

        let dW, dH, dx, dy;

        if (imgRatio > canvRatio) {
            // Image wider – fit height and crop sides
            dH = cH;
            dW = cH * imgRatio;
        } else {
            // Image taller – fit width and crop top/bottom
            dW = cW;
            dH = cW / imgRatio;
        }

        dx = (cW - dW) / 2;
        dy = (cH - dH) / 2;

        ctx.drawImage(img, dx, dy, dW, dH);
    }

    /* ──────────────────────────────────────────────────────────
       GSAP SCROLL TRIGGER
    ────────────────────────────────────────────────────────── */
    initScrollTrigger() {
        // Safety – if GSAP not loaded yet, retry in 200ms
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
            setTimeout(() => this.initScrollTrigger(), 200);
            return;
        }

        gsap.registerPlugin(ScrollTrigger);

        const totalFrames = this.frames.length;
        const frameObj = { frame: 0 };

        gsap.to(frameObj, {
            frame: totalFrames - 1,
            ease: 'none',
            scrollTrigger: {
                trigger: this.heroEl,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 0.5,          // slight smoothing
                onUpdate: (self) => {
                    const idx = Math.round(self.progress * (totalFrames - 1));
                    if (idx !== this.currentFrame) {
                        this.currentFrame = idx;
                        this.drawFrame(idx);
                    }
                },
            },
        });

        // Fade hero overlay out as user scrolls mid-way
        gsap.to('#hero-overlay', {
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: this.heroEl,
                start: '20% top',
                end: '50% top',
                scrub: true,
            },
        });

        // Fade scroll hint out early
        gsap.to('#hero-scroll-hint', {
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: this.heroEl,
                start: '5% top',
                end: '15% top',
                scrub: true,
            },
        });
    }

    /* ──────────────────────────────────────────────────────────
       LENIS SMOOTH SCROLL
    ────────────────────────────────────────────────────────── */
    initLenis() {
        if (typeof Lenis === 'undefined') {
            setTimeout(() => this.initLenis(), 200);
            return;
        }

        this.lenis = new Lenis({
            lerp: 0.08,
            smoothWheel: true,
            syncTouch: false,
        });

        // Integrate Lenis with GSAP ScrollTrigger ticker
        const raf = (time) => {
            this.lenis.raf(time);
            // Keep ScrollTrigger in sync
            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.update();
            }
            this.rafId = requestAnimationFrame(raf);
        };

        this.rafId = requestAnimationFrame(raf);
    }

    /* ──────────────────────────────────────────────────────────
       CAROUSEL
    ────────────────────────────────────────────────────────── */
    initCarousel() {
        const track = document.getElementById('carousel-track');
        const prevBtn = document.getElementById('carousel-prev');
        const nextBtn = document.getElementById('carousel-next');

        if (!track || !prevBtn || !nextBtn) return;

        // Calculate scroll amount = one card width + gap
        const getScrollAmount = () => {
            const card = track.querySelector('.card');
            if (!card) return 300;
            return card.getBoundingClientRect().width + 20; // 20 = gap ~1.25rem
        };

        prevBtn.addEventListener('click', () => {
            track.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            track.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
        });

        // Drag-to-scroll (desktop)
        let isDown = false;
        let startX, scrollLeft;

        track.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - track.offsetLeft;
            scrollLeft = track.scrollLeft;
            track.style.userSelect = 'none';
        });

        track.addEventListener('mouseleave', () => { isDown = false; });
        track.addEventListener('mouseup', () => { isDown = false; track.style.userSelect = ''; });
        track.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - track.offsetLeft;
            const walk = (x - startX) * 1.5;
            track.scrollLeft = scrollLeft - walk;
        });
    }

    /* ──────────────────────────────────────────────────────────
       SCROLL REVEAL ANIMATIONS (IntersectionObserver)
    ────────────────────────────────────────────────────────── */
    initRevealAnimations() {
        // Add reveal class to target elements
        const targets = document.querySelectorAll(
            '.first-look .eyebrow, .first-look .heading, .first-look .body-copy, .first-look .btn-group,' +
            '.section-header, .banner__content, .essentials-section .heading, .essential-card'
        );

        targets.forEach((el, i) => {
            el.classList.add('reveal');
            // Stagger delay based on order within parent
            const delay = (i % 4) * 0.1;
            el.style.transitionDelay = `${delay}s`;
        });

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );

        targets.forEach((el) => observer.observe(el));
    }

    /* ──────────────────────────────────────────────────────────
       NAV (scrolled state)
    ────────────────────────────────────────────────────────── */
    initNav() {
        const nav = document.getElementById('nav');
        if (!nav) return;

        const toggle = () => {
            nav.classList.toggle('scrolled', window.scrollY > 20);
        };

        window.addEventListener('scroll', toggle, { passive: true });
        toggle(); // run once on load
    }

    /* ──────────────────────────────────────────────────────────
       CLEANUP (optional)
    ────────────────────────────────────────────────────────── */
    destroy() {
        cancelAnimationFrame(this.rafId);
        window.removeEventListener('resize', this._onResize);
        if (this.lenis) this.lenis.destroy();
    }
}

/* ── Boot ──────────────────────────────────────────────────── */
// Wait for deferred scripts (GSAP / Lenis) to be available
document.addEventListener('DOMContentLoaded', () => {
    window._nike = new TigerExperience();
});
