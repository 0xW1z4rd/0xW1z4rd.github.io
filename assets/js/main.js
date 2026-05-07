/* Wizard Blog — main.js */

// ─── Header scroll state ──────────────────────────────────────────────────────
(function () {
  const header = document.getElementById('site-header');
  if (!header) return;
  window.addEventListener('scroll', function () {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
})();

// ─── Mobile navigation ────────────────────────────────────────────────────────
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const menu   = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', function () {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', function (e) {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('is-open');
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();

// ─── Theme toggle ─────────────────────────────────────────────────────────────
(function () {
  const btn  = document.querySelector('.theme-toggle');
  const html = document.documentElement;
  const stored = localStorage.getItem('wizard-theme');
  if (stored) html.setAttribute('data-theme', stored);

  if (!btn) return;
  btn.addEventListener('click', function () {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('wizard-theme', next);
  });
})();

// ─── Reading progress bar ─────────────────────────────────────────────────────
(function () {
  const bar = document.querySelector('.reading-progress');
  if (!bar) return;

  function update() {
    const scroll = window.scrollY;
    const max    = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = max > 0 ? Math.min((scroll / max) * 100, 100) + '%' : '0%';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();

// ─── Build TOC from headings ──────────────────────────────────────────────────
(function () {
  const nav     = document.getElementById('toc-nav');
  const content = document.querySelector('.post-content');
  if (!nav || !content) return;

  const headings = content.querySelectorAll('h2, h3');
  if (headings.length < 2) {
    const aside = document.getElementById('post-toc');
    if (aside) aside.classList.add('hidden');
    return;
  }

  let html = '<ul class="toc-list">';
  let inSub = false;

  headings.forEach(function (h) {
    if (!h.id) {
      h.id = h.textContent
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }

    if (h.tagName === 'H2') {
      if (inSub) { html += '</ul></li>'; inSub = false; }
      html += '<li class="toc-item toc-h2"><a href="#' + h.id + '" class="toc-link">' + h.textContent + '</a>';
    } else {
      if (!inSub) { html += '<ul class="toc-sublist">'; inSub = true; }
      html += '<li class="toc-item toc-h3"><a href="#' + h.id + '" class="toc-link">' + h.textContent + '</a></li>';
    }
  });

  if (inSub) html += '</ul></li>';
  html += '</ul>';
  nav.innerHTML = html;

  // Scrollspy
  const links = nav.querySelectorAll('.toc-link');
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(function (l) {
          l.classList.toggle('active', l.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-' + (70 + 24) + 'px 0px -65% 0px' });

  headings.forEach(function (h) { observer.observe(h); });
})();

// ─── Copy code buttons ────────────────────────────────────────────────────────
(function () {
  if (!navigator.clipboard) return;

  document.querySelectorAll('.highlight').forEach(function (block) {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

    btn.addEventListener('click', function () {
      const code = block.querySelector('code');
      const text = code ? code.innerText : block.innerText;
      navigator.clipboard.writeText(text).then(function () {
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          btn.classList.remove('copied');
        }, 2000);
      });
    });

    block.appendChild(btn);
  });
})();

// ─── Search modal ─────────────────────────────────────────────────────────────
(function () {
  const modal  = document.getElementById('search-modal');
  const input  = document.getElementById('search-input');
  const close  = document.querySelector('.search-close');
  const openBtn = document.querySelector('.search-toggle');
  if (!modal) return;

  function open() {
    modal.classList.add('is-open');
    setTimeout(function () { if (input) input.focus(); }, 80);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    if (input) input.value = '';
    const results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
  }

  if (openBtn) openBtn.addEventListener('click', open);
  if (close)   close.addEventListener('click', closeModal);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      modal.classList.contains('is-open') ? closeModal() : open();
    }
  });

  // Keyboard navigation in results
  modal.addEventListener('keydown', function (e) {
    const items = modal.querySelectorAll('.search-result-item');
    if (!items.length) return;
    const focused = modal.querySelector('.search-result-item:focus');
    const idx = Array.from(items).indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(idx + 1, items.length - 1)].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) { if (input) input.focus(); }
      else items[idx - 1].focus();
    }
  });
})();

// ─── Back to top ──────────────────────────────────────────────────────────────
(function () {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', function () {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// ─── Mermaid init ─────────────────────────────────────────────────────────────
(function () {
  if (typeof mermaid === 'undefined') return;
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    themeVariables: {
      primaryColor: '#7c3aed',
      primaryTextColor: '#f5f3ff',
      primaryBorderColor: '#a855f7',
      lineColor: '#c084fc',
      background: '#0f0b1a',
      mainBkg: '#161124',
      nodeBorder: '#7c3aed',
      clusterBkg: '#1e1633',
      titleColor: '#f5f3ff',
      edgeLabelBackground: '#161124',
    },
    securityLevel: 'loose',
  });
})();

// ─── Smooth anchor links ──────────────────────────────────────────────────────
(function () {
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, '', '#' + id);
      }
    });
  });
})();

// ─── Category filter (research/writeups pages) ────────────────────────────────
(function () {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('cat');
  if (!cat) return;

  document.querySelectorAll('.post-card, .post-card-list').forEach(function (card) {
    const cats = card.querySelectorAll('[data-category]');
    const slugs = Array.from(cats).map(function (el) {
      return el.getAttribute('data-category').toLowerCase().replace(/\s+/g, '-');
    });
    card.style.display = slugs.includes(cat) ? '' : 'none';
  });
})();
