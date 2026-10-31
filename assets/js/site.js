(function () {
    'use strict';

    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const navToggle = document.getElementById('navToggle');
    const siteNav = document.getElementById('siteNav');
    const progress = document.getElementById('scrollProgress');
    const backToTop = document.getElementById('backToTop');
    const cookieNotice = document.getElementById('cookieNotice');
    const dismissCookie = document.getElementById('dismissCookie');

    requestAnimationFrame(() => body.classList.add('page-ready'));

    const syncThemeLabel = () => {
        if (!themeToggle) return;
        const dark = body.classList.contains('dark-theme');
        themeToggle.textContent = dark ? 'Light Mode' : 'Dark Mode';
        themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
    };

    if (localStorage.getItem('praise-theme') === 'dark') body.classList.add('dark-theme');
    syncThemeLabel();
    themeToggle?.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        localStorage.setItem('praise-theme', body.classList.contains('dark-theme') ? 'dark' : 'light');
        syncThemeLabel();
    });

    navToggle?.addEventListener('click', () => {
        const open = siteNav.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    const updateScroll = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
        if (progress) progress.style.width = percent + '%';
        if (backToTop) backToTop.hidden = window.scrollY < 400;
    };
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();
    backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    if (cookieNotice && !localStorage.getItem('praise-cookie-notice')) cookieNotice.hidden = false;
    dismissCookie?.addEventListener('click', () => {
        localStorage.setItem('praise-cookie-notice', 'dismissed');
        cookieNotice.hidden = true;
    });

    document.querySelectorAll('form').forEach((form) => {
        form.addEventListener('invalid', (event) => {
            event.target.setAttribute('aria-invalid', 'true');
        }, true);
        form.addEventListener('submit', () => {
            const submit = form.querySelector('button[type="submit"]');
            if (!submit || form.classList.contains('site-search')) return;
            submit.disabled = true;
            submit.classList.add('is-loading');
            submit.dataset.originalText = submit.textContent;
            submit.textContent = 'Working...';
        });
    });

    document.querySelectorAll('input[type="password"]').forEach((input) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'password-toggle';
        button.textContent = 'Show';
        button.setAttribute('aria-label', 'Show password');
        input.parentElement.classList.add('password-field');
        input.parentElement.appendChild(button);
        button.addEventListener('click', () => {
            const visible = input.type === 'text';
            input.type = visible ? 'password' : 'text';
            button.textContent = visible ? 'Show' : 'Hide';
            button.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
        });
    });

    document.querySelectorAll('[data-copy]').forEach((button) => {
        button.addEventListener('click', async () => {
            const value = button.dataset.copy;
            try {
                await navigator.clipboard.writeText(value);
                button.textContent = 'Copied';
                setTimeout(() => { button.textContent = 'Copy link'; }, 1600);
            } catch (error) {
                button.textContent = 'Copy failed';
            }
        });
    });
})();
