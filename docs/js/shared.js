(() => {
  'use strict';

  const config = window.PRAISE_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes('YOUR-PROJECT') && !config.SUPABASE_ANON_KEY.includes('YOUR_');
  const supabase = configured && window.supabase?.createClient
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const roleLabels = {
    chair: 'Praise Team Chair',
    secretary: 'Secretary',
    music_director: 'Music Director',
    band_director: 'Band/Worship Director',
    prayer_director: 'Prayer Director',
    member: 'Member'
  };
  const roleLabel = (role) => roleLabels[role] || 'Member';
  const showStatus = (message, type = 'info') => {
    const status = document.getElementById('page-status');
    if (!status) return;
    status.textContent = message;
    status.className = `alert alert-${type}`;
    status.hidden = !message;
  };
  const getSession = async () => {
    if (!supabase) return { user: null, role: null };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { user: null, role: null };
    const { data } = await supabase.from('roles').select('role').eq('user_id', user.id).maybeSingle();
    return { user, role: data?.role || 'member' };
  };
  const signedUrl = async (bucket, path) => {
    if (!path || !supabase) return '';
    if (['event-media', 'gallery-public'].includes(bucket)) return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) return '';
    return data.signedUrl;
  };
  const uploadFile = async (bucket, file, userId, prefix = 'upload') => {
    if (!supabase || !file) return { path: null, error: null };
    const allowed = bucket === 'event-media'
      ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      : ['image/jpeg', 'image/png', 'image/webp'];
    const maximum = 10 * 1024 * 1024;
    if (!allowed.includes(file.type) || file.size < 1 || file.size > maximum) {
      return { path: null, error: 'Choose a supported file no larger than 10 MB.' };
    }
    if (file.type.startsWith('image/')) {
      const validImage = await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = URL.createObjectURL(file);
      });
      if (!validImage) return { path: null, error: 'The selected image could not be read.' };
    }
    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${userId}/${prefix}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    return error ? { path: null, error: 'File upload failed. Check your account permissions and bucket settings.' } : { path, error: null };
  };
  const escapeQuery = (value) => value.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();

  const header = document.getElementById('site-header');
  if (header) {
    header.insertAdjacentHTML('beforebegin', '<div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>');
    header.innerHTML = `
      <header class="topbar" id="site-header-inner">
        <a href="index.html" class="brand">ST ANDREWS CCAP PRAISE TEAM</a>
        <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteNav" aria-label="Open menu">Menu</button>
        <nav class="topnav" id="siteNav" aria-label="Main navigation">
          <a href="index.html">Home</a>
          <a href="members.html" data-member-link hidden>Members</a>
          <a href="chair-members.html" data-chair-link hidden>Manage Members</a>
          <a href="gallery.html" data-member-link hidden>Gallery</a>
          <a href="dashboard.html" data-member-link hidden>Dashboard</a>
          <a href="login.html" data-login-link>Login</a>
          <button type="button" class="small-link" data-logout hidden>Logout</button>
          <form class="site-search" action="search.html" method="get" role="search">
            <label class="sr-only" for="site-search-input">Search site</label>
            <input id="site-search-input" name="q" type="search" placeholder="Search" minlength="2">
            <button type="submit" aria-label="Search">Search</button>
          </form>
        </nav>
      </header>`;
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.innerHTML = `
      <div class="bottom-toolbar">
        <button type="button" id="themeToggle" class="btn btn-secondary theme-toggle" aria-label="Toggle dark mode">Dark Mode</button>
        <button type="button" class="btn btn-danger" data-logout hidden>Logout</button>
      </div>
      <a class="contact-float" href="mailto:praise-team@example.com" aria-label="Contact the praise team">Contact</a>
      <button type="button" class="back-to-top" id="backToTop" aria-label="Back to top" hidden>&uarr;</button>
      <footer class="site-footer">
        <span>&copy; ${new Date().getFullYear()} St Andrews CCAP Praise Team</span>
        <span><a href="terms.html">Terms</a> <a href="privacy.html">Privacy</a></span>
      </footer>`;
  }

  const initShared = async () => {
    const body = document.body;
    requestAnimationFrame(() => body.classList.add('page-ready'));
    if (!supabase) showStatus('Add your Supabase project URL and anon key in js/config.js to connect the site.', 'danger');

    const themeToggle = document.getElementById('themeToggle');
    const isDark = localStorage.getItem('praise-theme') === 'dark';
    if (isDark) body.classList.add('dark-theme');
    const syncTheme = () => {
      if (!themeToggle) return;
      const dark = body.classList.contains('dark-theme');
      themeToggle.textContent = dark ? 'Light Mode' : 'Dark Mode';
      themeToggle.setAttribute('aria-pressed', String(dark));
    };
    syncTheme();
    themeToggle?.addEventListener('click', () => {
      body.classList.toggle('dark-theme');
      localStorage.setItem('praise-theme', body.classList.contains('dark-theme') ? 'dark' : 'light');
      syncTheme();
    });

    const nav = document.getElementById('siteNav');
    document.getElementById('navToggle')?.addEventListener('click', (event) => {
      const open = nav.classList.toggle('is-open');
      event.currentTarget.setAttribute('aria-expanded', String(open));
    });
    const scroll = () => {
      const extent = document.documentElement.scrollHeight - window.innerHeight;
      const progress = document.getElementById('scrollProgress');
      if (progress) progress.style.width = `${extent > 0 ? (window.scrollY / extent) * 100 : 0}%`;
      const back = document.getElementById('backToTop');
      if (back) back.hidden = window.scrollY < 400;
    };
    window.addEventListener('scroll', scroll, { passive: true });
    scroll();
    document.getElementById('backToTop')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    const { user, role } = await getSession();
    document.querySelectorAll('[data-member-link]').forEach((link) => { link.hidden = !user; });
    document.querySelectorAll('[data-chair-link]').forEach((link) => { link.hidden = role !== 'chair'; });
    document.querySelectorAll('[data-login-link]').forEach((link) => { link.hidden = Boolean(user); });
    document.querySelectorAll('[data-logout]').forEach((button) => {
      button.hidden = !user;
      button.style.display = user ? '' : 'none';
      button.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      });
    });
    document.body.dataset.userId = user?.id || '';
    document.body.dataset.role = role || '';
  };

  window.Praise = { supabase, escapeHTML, roleLabel, showStatus, getSession, signedUrl, uploadFile, escapeQuery };
  initShared();
})();
