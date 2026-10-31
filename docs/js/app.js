(() => {
  'use strict';

  const { supabase, escapeHTML: e, roleLabel, showStatus, getSession, signedUrl, uploadFile, escapeQuery } = window.Praise;
  const page = document.body.dataset.page;
  const formData = (form) => Object.fromEntries(new FormData(form).entries());

  // Attaches ONE submit handler to a form. Re-running a page loader replaces the
  // handler instead of stacking duplicates, and event.currentTarget stays valid
  // after any await (the real event's currentTarget becomes null).
  const onSubmit = (id, handler) => {
    const form = document.getElementById(id);
    if (!form) return;
    form.onsubmit = (event) => {
      event.preventDefault();
      return handler({ currentTarget: form, preventDefault() {} });
    };
  };

  const dateTime = (value) => value ? new Date(value).toLocaleString() : 'Not set';
  const dateOnly = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString() : 'Not set';
  const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const safeLink = (value) => {
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch { return '#'; }
  };
  const fail = (error, fallback = 'That request could not be completed.') => {
    console.error(error);
    showStatus(fallback, 'danger');
  };
  const redirectForRole = (role) => ({
    chair: 'chair.html', secretary: 'secretary.html', music_director: 'music-director.html',
    band_director: 'band-director.html', prayer_director: 'prayer-director.html', member: 'member.html'
  })[role] || 'login.html';
  const guard = async (requiredRole) => {
    if (!supabase) return null;
    const session = await getSession();
    if (!session.user) {
      window.location.replace('login.html');
      return null;
    }
    if (requiredRole && session.role !== requiredRole) {
      window.location.replace(redirectForRole(session.role));
      return null;
    }
    return session;
  };
  const showEmpty = (target, message) => {
    target.innerHTML = `<p class="empty-state">${e(message)}</p>`;
  };
  const profileNameMap = async (ids) => {
    if (!ids.length) return {};
    const { data, error } = await supabase.from('profiles').select('id,name').in('id', [...new Set(ids)]);
    if (error) throw error;
    return Object.fromEntries((data || []).map((profile) => [profile.id, profile.name]));
  };
  const renderEventList = async (target, rows, compact = false) => {
    if (!rows.length) return showEmpty(target, 'No events to show yet.');
    const items = await Promise.all(rows.map(async (event) => {
      const poster = await signedUrl('event-media', event.poster_path);
      const attachment = await signedUrl('event-media', event.attachment_path);
      return `<li>${poster ? `<img class="event-poster" src="${e(poster)}" alt="${e(event.title)}">` : ''}<strong>${e(event.title)}</strong><br>${e(dateTime(event.event_date))}<br>${e(event.location || 'Location not set')}${!compact && event.description ? `<p>${e(event.description)}</p>` : ''}${attachment ? `<br><a href="${e(attachment)}" target="_blank" rel="noopener">View letter/attachment</a>` : ''}</li>`;
    }));
    target.innerHTML = `<ul class="meta-list">${items.join('')}</ul>`;
  };
  const reportMarkup = (report) => `<article class="search-result"><span class="badge">${e(roleLabel(report.department))}</span><h3>${e(report.title)}</h3><p>${e(report.summary)}</p>${report.content ? `<p>${e(report.content)}</p>` : ''}<small>Last updated: ${e(dateTime(report.updated_at || report.created_at))}</small></article>`;

  async function loadHome() {
    if (!supabase) return;
    const verseTarget = document.getElementById('daily-verse');
    const today = localDate();
    const { data: verses, error: verseError } = await supabase.from('daily_verses_public').select('verse_text,member_name,created_at').eq('posted_on', today).order('created_at', { ascending: false }).limit(1);
    if (verseError) fail(verseError);
    else if (!verses?.length) showEmpty(verseTarget, 'No verse has been posted for today yet.');
    else {
      verseTarget.innerHTML = `<blockquote class="verse-quote">${e(verses[0].verse_text)}</blockquote><p class="verse-attribution"><strong>Posted by</strong> ${e(verses[0].member_name || 'Team member')}</p>`;
    }

    const now = new Date().toISOString();
    const [upcoming, past, updates, reports, prayerPoints] = await Promise.all([
      supabase.from('events_public').select('*').gte('event_date', now).order('event_date').limit(3),
      supabase.from('events_public').select('*').lt('event_date', now).order('event_date', { ascending: false }).limit(3),
      supabase.from('updates_public').select('title,content,author_name,published_at,created_at').order('published_at', { ascending: false }).order('created_at', { ascending: false }).limit(5),
      supabase.from('department_reports_public').select('department,title,summary,updated_at,created_at').order('published_at', { ascending: false }).order('created_at', { ascending: false }).limit(6),
      supabase.from('daily_prayer_points_public').select('id,prayer_point,created_at').eq('prayer_date', today).order('created_at', { ascending: false })
    ]);
    for (const result of [upcoming, past, updates, reports, prayerPoints]) if (result.error) fail(result.error);
    await renderEventList(document.getElementById('upcoming-events'), upcoming.data || []);
    await renderEventList(document.getElementById('past-events'), past.data || [], true);

    const updateTarget = document.getElementById('latest-updates');
    if (!updates.data?.length) showEmpty(updateTarget, 'No updates published yet.');
    else {
      updateTarget.innerHTML = `<ul class="meta-list">${updates.data.map((item) => `<li><strong>${e(item.title)}</strong><br><small>By ${e(item.author_name || 'Team member')}</small><br>${e(item.content)}</li>`).join('')}</ul>`;
    }
    const reportTarget = document.getElementById('published-reports');
    reportTarget.innerHTML = reports.data?.length ? reports.data.map(reportMarkup).join('') : '<p class="empty-state">No published reports yet.</p>';
    const prayerTarget = document.getElementById('daily-prayer-points');
    if (prayerTarget) prayerTarget.innerHTML = prayerPoints.data?.length
      ? `<ul class="meta-list">${prayerPoints.data.map((item) => `<li>${e(item.prayer_point)}</li>`).join('')}</ul>`
      : '<p class="empty-state">No prayer points have been posted for today.</p>';
  }

  async function handleLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        if (!supabase) return showStatus('Login is unavailable because the Supabase client did not initialize. Check js/config.js and reload.', 'danger');
        showStatus('Signing in...', 'info');
        const values = formData(form);
        const { data, error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
        if (error) return showStatus(error.message || 'Sign-in failed. Check your email and password.', 'danger');
        const { data: roleRecord, error: roleError } = await supabase.from('roles').select('role').eq('user_id', data.user.id).maybeSingle();
        if (roleError) return showStatus('Signed in, but your role could not be loaded. Ask the chair to verify your account role.', 'danger');
        window.location.href = redirectForRole(roleRecord?.role || 'member');
      } catch (error) {
        fail(error, 'Could not reach Supabase during sign-in. Check your connection and retry.');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
    if (!supabase) return;
    const session = await getSession();
    if (session.user) return window.location.replace(redirectForRole(session.role));
  }

  async function handleLogout() {
    if (page !== 'logout' || !supabase) return;
    await supabase.auth.signOut();
    window.location.replace('index.html');
  }

  async function handleSetPassword() {
    const form = document.getElementById('set-password-form');
    if (!form || !supabase) return;
    const { user } = await getSession();
    if (!user) {
      showStatus('Open the invitation link from your email to set your password.', 'danger');
      form.hidden = true;
      return;
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formData(form);
      if (values.password.length < 12 || values.password !== values.confirm_password) {
        return showStatus('Use at least 12 characters and make both passwords match.', 'danger');
      }
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) return showStatus(error.message, 'danger');
      const { data: roleRecord } = await supabase.from('roles').select('role').eq('user_id', user.id).maybeSingle();
      window.location.replace(redirectForRole(roleRecord?.role || 'member'));
    });
  }

  async function loadMembers() {
    const session = await guard();
    if (!session) return;
    const target = document.getElementById('members-grid');
    const { data, error } = await supabase.from('profiles').select('id,name,email,role:roles(role),position,phone,location,social_media,marital_status,photo_path').order('name');
    if (error) return fail(error, 'The directory could not be loaded.');
    if (!data?.length) return showEmpty(target, 'No members have been added yet.');
    const cards = await Promise.all(data.map(async (member) => {
      const photo = await signedUrl('member-media', member.photo_path);
      const role = member.role?.role || 'member';
      return `<article class="member-card">${photo ? `<img class="member-photo" src="${e(photo)}" alt="${e(member.name)}">` : `<div class="member-photo member-photo-placeholder" aria-label="No photo available">${e(member.name.slice(0, 1))}</div>`}<div class="member-body"><h2 class="member-name">${e(member.name)}</h2><p class="member-meta"><strong>${e(roleLabel(role))}</strong></p>${member.position ? `<p class="member-detail"><strong>Position:</strong> ${e(member.position)}</p>` : ''}${member.email ? `<p class="member-detail"><strong>Email:</strong> ${e(member.email)}</p>` : ''}${member.phone ? `<p class="member-detail"><strong>Phone:</strong> ${e(member.phone)}</p>` : ''}${member.location ? `<p class="member-detail"><strong>Location:</strong> ${e(member.location)}</p>` : ''}${member.social_media ? `<p class="member-detail"><strong>Social:</strong> ${e(member.social_media)}</p>` : ''}${member.marital_status ? `<p class="member-detail"><strong>Marital Status:</strong> ${e(member.marital_status)}</p>` : ''}</div></article>`;
    }));
    target.innerHTML = cards.join('');
  }

  async function loadChair() {
    const session = await guard('chair');
    if (!session) return;
    document.getElementById('profile-form').closest('.card').hidden = true;
    document.getElementById('chair-members').closest('.card').hidden = true;
    if (!document.querySelector('.dash-header a[href="chair-members.html"]')) {
      document.querySelector('.dash-header').insertAdjacentHTML('beforeend', '<a class="btn btn-primary" href="chair-members.html">Manage Members</a>');
    }
    const roleSelect = document.querySelector('#profile-form select[name="role"]');
    if (roleSelect && !roleSelect.querySelector('option[value="prayer_director"]')) {
      roleSelect.add(new Option('Prayer Director', 'prayer_director'));
    }
    const [membersResult, reportsResult] = await Promise.all([
      supabase.from('profiles').select('id,name,email,phone,location,position,social_media,marital_status,role:roles(role)').order('name'),
      supabase.from('department_reports').select('*').order('created_at', { ascending: false })
    ]);
    if (membersResult.error) fail(membersResult.error);
    if (reportsResult.error) fail(reportsResult.error);
    const memberTarget = document.getElementById('chair-members');
    memberTarget.innerHTML = (membersResult.data || []).map((member) => `<tr><td>${e(member.name)}</td><td>${e(roleLabel(member.role?.role))}</td><td>${e(member.phone || 'N/A')}</td><td>${e(member.location || 'N/A')}</td><td><button class="small-link" type="button" data-edit-member="${e(member.id)}">Edit</button></td></tr>`).join('');
    document.querySelectorAll('[data-edit-member]').forEach((button) => button.addEventListener('click', () => {
      const member = membersResult.data.find((item) => item.id === button.dataset.editMember);
      if (!member) return;
      const form = document.getElementById('profile-form');
      for (const key of ['id', 'name', 'email', 'phone', 'location', 'position', 'social_media', 'marital_status']) form.elements[key].value = member[key] || '';
      form.elements.email.readOnly = true;
      form.elements.role.value = member.role?.role || 'member';
      form.scrollIntoView({ behavior: 'smooth' });
    }));

    const reportTarget = document.getElementById('report-queue');
    reportTarget.innerHTML = (reportsResult.data || []).map((report) => `<tr><td>${e(roleLabel(report.department))}</td><td>${e(report.title)}</td><td><span class="badge ${report.published ? 'published' : 'draft'}">${e(report.published ? 'Published' : report.status)}</span></td><td>${report.status === 'pending' && !report.published ? `<button type="button" class="btn btn-success" data-publish-report="${e(report.id)}">Approve &amp; Publish</button>` : report.published ? 'Live' : 'Waiting'}</td></tr>`).join('');
    document.querySelectorAll('[data-publish-report]').forEach((button) => button.addEventListener('click', async () => {
      const { error } = await supabase.from('department_reports').update({ published: true, status: 'published', published_at: new Date().toISOString() }).eq('id', button.dataset.publishReport);
      if (error) return fail(error);
      button.closest('tr').querySelector('.badge').textContent = 'Published';
      button.closest('tr').querySelector('.badge').classList.add('published');
      button.closest('td').textContent = 'Live';
      showStatus('Report published.', 'success');
    }));

    onSubmit('profile-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const userId = values.id || null;
      if (!userId) return showStatus('Create the account in Supabase Authentication first, then edit its profile here.', 'info');
      const { role } = values;
      const profile = {
        name: values.name,
        phone: values.phone || null,
        location: values.location || null,
        position: values.position || null,
        social_media: values.social_media || null,
        marital_status: values.marital_status || null
      };
      const { error: profileError } = await supabase.from('profiles').update(profile).eq('id', userId);
      if (profileError) return fail(profileError);
      const { error: roleError } = await supabase.from('roles').upsert({ user_id: userId, role });
      if (roleError) return fail(roleError);
      form.reset();
      showStatus('Member profile saved.', 'success');
      await loadChair();
    });
    onSubmit('event-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const { data, error } = await supabase.from('events').insert({ title: values.title, event_date: new Date(values.event_date).toISOString(), location: values.location || null, description: values.description || null, created_by: session.user.id }).select('id').single();
      if (error) return fail(error);
      let posterPath = null;
      let attachmentPath = null;
      for (const [field, output] of [['poster', 'posterPath'], ['attachment', 'attachmentPath']]) {
        const file = form.elements[field].files[0];
        if (!file) continue;
        const validType = field === 'poster'
          ? ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
          : ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type);
        if (!validType) return showStatus(`Choose a valid ${field} file type.`, 'danger');
        const uploaded = await uploadFile('event-media', file, session.user.id, `event-${data.id}`);
        if (uploaded.error) return showStatus(uploaded.error, 'danger');
        if (output === 'posterPath') posterPath = uploaded.path; else attachmentPath = uploaded.path;
      }
      if (posterPath || attachmentPath) {
        const { error: updateError } = await supabase.from('events').update({ poster_path: posterPath, attachment_path: attachmentPath }).eq('id', data.id);
        if (updateError) return fail(updateError);
      }
      if (posterPath) {
        const { error: galleryError } = await supabase.from('gallery_photos').insert({ uploader_id: session.user.id, source_type: 'event', source_id: data.id, image_path: posterPath, caption: values.title });
        if (galleryError) return fail(galleryError);
      }
      form.reset();
      showStatus('Event created.', 'success');
    });
    onSubmit('update-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const { error } = await supabase.from('updates').insert({ title: values.title, content: values.content, author_id: session.user.id, published_at: new Date().toISOString() });
      if (error) return fail(error);
      form.reset();
      showStatus('Update published.', 'success');
    });
  }

  async function loadChairMembers() {
    const session = await guard('chair');
    if (!session) return;
    const target = document.getElementById('managed-members');
    const renderMembers = async () => {
      const { data: members, error } = await supabase.from('profiles')
        .select('id,name,email,position,phone,location,social_media,marital_status,role:roles(role)').order('name');
      if (error) throw error;
      target.innerHTML = (members || []).map((member) => `<tr><td>${e(member.name)}</td><td>${e(member.email)}</td><td>${e(roleLabel(member.role?.role))}</td><td>${e(member.position || 'N/A')}</td><td>${e(member.phone || 'N/A')}</td><td><button class="small-link" type="button" data-edit-profile="${e(member.id)}">Edit</button></td></tr>`).join('');
      document.querySelectorAll('[data-edit-profile]').forEach((button) => button.addEventListener('click', () => {
        const member = members.find((item) => item.id === button.dataset.editProfile);
        if (!member) return;
        const form = document.getElementById('edit-member-form');
        for (const key of ['id', 'name', 'email', 'position', 'phone', 'location', 'social_media', 'marital_status']) form.elements[key].value = member[key] || '';
        form.elements.role.value = member.role?.role || 'member';
        document.getElementById('edit-member-section').hidden = false;
        form.scrollIntoView({ behavior: 'smooth' });
      }));
    };
    try { await renderMembers(); } catch (error) { return fail(error, 'The member list could not be loaded.'); }

    onSubmit('invite-member-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const { data, error: inviteError } = await supabase.functions.invoke('invite-member', { body: values });
      if (inviteError) return fail(inviteError, 'Member invitation failed. Confirm the invite function is deployed and configured.');
      if (data?.error) return showStatus(data.error, 'danger');
      form.reset();
      showStatus(data?.message || 'Invitation sent.', 'success');
      try { await renderMembers(); } catch (error) { fail(error); }
    });
    onSubmit('edit-member-form', async (event) => {
      event.preventDefault();
      const values = formData(event.currentTarget);
      const { error: profileError } = await supabase.from('profiles').update({
        name: values.name,
        position: values.position || null,
        phone: values.phone || null,
        location: values.location || null,
        social_media: values.social_media || null,
        marital_status: values.marital_status || null
      }).eq('id', values.id);
      if (profileError) return fail(profileError);
      const { error: roleError } = await supabase.from('roles').upsert({ user_id: values.id, role: values.role });
      if (roleError) return fail(roleError);
      document.getElementById('edit-member-section').hidden = true;
      showStatus('Member profile saved.', 'success');
      try { await renderMembers(); } catch (error) { fail(error); }
    });
    document.getElementById('cancel-edit-member')?.addEventListener('click', () => {
      document.getElementById('edit-member-section').hidden = true;
    });
  }

  async function loadSecretary() {
    const session = await guard('secretary');
    if (!session) return;
    const [membersResult, financeResult] = await Promise.all([
      supabase.from('profiles').select('id,name').order('name'),
      supabase.from('finance_records').select('*,member:profiles!finance_records_member_id_fkey(name)').order('month', { ascending: false })
    ]);
    if (membersResult.error) fail(membersResult.error);
    if (financeResult.error) fail(financeResult.error);
    const memberSelect = document.getElementById('finance-member');
    memberSelect.innerHTML = '<option value="">Select member</option>' + (membersResult.data || []).map((member) => `<option value="${e(member.id)}">${e(member.name)}</option>`).join('');
    document.getElementById('finance-records').innerHTML = (financeResult.data || []).map((record) => `<tr><td>${e(record.member?.name || 'Member')}</td><td>${e(record.month)}</td><td>$${Number(record.contributions).toFixed(2)}</td><td>$${Number(record.offerings).toFixed(2)}</td><td>${e(record.notes || 'N/A')}</td></tr>`).join('');
    onSubmit('finance-form', async (event) => {
      event.preventDefault();
      const values = formData(event.currentTarget);
      const { error } = await supabase.from('finance_records').upsert({ member_id: values.member_id, month: values.month, contributions: Number(values.contributions), offerings: Number(values.offerings), notes: values.notes || null, recorded_by: session.user.id }, { onConflict: 'member_id,month' });
      if (error) return fail(error);
      showStatus('Finance record saved.', 'success');
      await loadSecretary();
    });
    bindReportForm(session, 'secretary');
  }

  function bindReportForm(session, department) {
    onSubmit('report-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const { error } = await supabase.from('department_reports').insert({ department, title: values.title, summary: values.summary, content: values.content, created_by: session.user.id, status: 'pending', published: false });
      if (error) return fail(error);
      form.reset();
      showStatus('Report submitted to the chair for approval.', 'success');
    });
  }

  async function loadMusicDirector() {
    const session = await guard('music_director');
    if (!session) return;
    const { data, error } = await supabase.from('department_music').select('*').order('rehearsal_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) fail(error);
    document.getElementById('music-plans').innerHTML = (data || []).map((plan) => `<tr><td>${e(plan.title)}</td><td>${e(dateTime(plan.rehearsal_date))}</td><td>${e(plan.notes || 'N/A')}</td></tr>`).join('');
    onSubmit('music-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const { error: saveError } = await supabase.from('department_music').insert({ title: values.title, notes: values.notes || null, rehearsal_date: values.rehearsal_date ? new Date(values.rehearsal_date).toISOString() : null, created_by: session.user.id });
      if (saveError) return fail(saveError);
      form.reset();
      showStatus('Music plan saved.', 'success');
      await loadMusicDirector();
    });
    bindReportForm(session, 'music_director');
  }

  async function loadBandDirector() {
    const session = await guard('band_director');
    if (!session) return;
    const { data, error } = await supabase.from('department_band').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    document.getElementById('band-plans').innerHTML = (data || []).map((plan) => `<tr><td>${e(plan.title)}</td><td>${e(plan.assignments || 'N/A')}</td><td>${e(plan.equipment || 'N/A')}</td><td>${e(plan.schedule_notes || 'N/A')}</td></tr>`).join('');
    onSubmit('band-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const { error: saveError } = await supabase.from('department_band').insert({ title: values.title, assignments: values.assignments || null, equipment: values.equipment || null, schedule_notes: values.schedule_notes || null, created_by: session.user.id });
      if (saveError) return fail(saveError);
      form.reset();
      showStatus('Band plan saved.', 'success');
      await loadBandDirector();
    });
    bindReportForm(session, 'band_director');
  }

  async function loadMember() {
    const session = await guard();
    if (!session) return;
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (error) return fail(error);
    const memberVerseForm = document.getElementById('verse-form');
    if (memberVerseForm) {
      memberVerseForm.hidden = true;
      if (memberVerseForm.previousElementSibling) memberVerseForm.previousElementSibling.hidden = true;
    }
    const form = document.getElementById('profile-edit-form');
    for (const key of ['name', 'position', 'phone', 'location', 'social_media', 'marital_status']) form.elements[key].value = profile[key] || '';
    const photo = await signedUrl('member-media', profile.photo_path);
    document.getElementById('profile-view').innerHTML = `${photo ? `<img src="${e(photo)}" alt="Profile photo" class="profile-avatar">` : `<div class="profile-avatar-placeholder">${e(profile.name.slice(0, 1))}</div>`}<p><strong>${e(profile.name)}</strong></p><p>${e(roleLabel(session.role))}</p>`;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formData(form);
      const { error: saveError } = await supabase.from('profiles').update({ name: values.name, position: values.position || null, phone: values.phone || null, location: values.location || null, social_media: values.social_media || null, marital_status: values.marital_status || null }).eq('id', session.user.id);
      if (saveError) return fail(saveError);
      showStatus('Profile saved.', 'success');
      document.querySelector('#profile-view p strong').textContent = values.name;
    });
    onSubmit('profile-photo-form', async (event) => {
      event.preventDefault();
      const file = event.currentTarget.elements.photo.files[0];
      if (!file) return showStatus('Choose a photo first.', 'danger');
      const uploaded = await uploadFile('member-media', file, session.user.id, 'profile');
      if (uploaded.error) return showStatus(uploaded.error, 'danger');
      const { error: saveError } = await supabase.from('profiles').update({ photo_path: uploaded.path }).eq('id', session.user.id);
      if (saveError) return fail(saveError);
      await supabase.from('gallery_photos').insert({ uploader_id: session.user.id, source_type: 'member', source_id: session.user.id, image_path: uploaded.path, caption: 'Profile photo' });
      showStatus('Profile picture updated.', 'success');
      const photoUrl = await signedUrl('member-media', uploaded.path);
      document.getElementById('profile-view').innerHTML = `<img src="${e(photoUrl)}" alt="Profile photo" class="profile-avatar"><p><strong>${e(profile.name)}</strong></p><p>${e(roleLabel(session.role))}</p>`;
    });

    const [events, updates, reports, photos] = await Promise.all([
      supabase.from('events_public').select('*').gte('event_date', new Date().toISOString()).order('event_date').limit(5),
      supabase.from('updates_public').select('title,content,author_name,published_at').order('published_at', { ascending: false }).limit(5),
      supabase.from('department_reports_public').select('*').order('published_at', { ascending: false }).limit(5),
      supabase.from('member_photos').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    ]);
    for (const result of [events, updates, reports, photos]) if (result.error) fail(result.error);
    await renderEventList(document.getElementById('member-events'), events.data || [], true);
    document.getElementById('member-updates').innerHTML = (updates.data || []).map((item) => `<article><strong>${e(item.title)}</strong><br><small>By ${e(item.author_name || 'Team member')}</small><p>${e(item.content)}</p></article>`).join('') || '<p class="empty-state">No published updates.</p>';
    document.getElementById('member-reports').innerHTML = (reports.data || []).map(reportMarkup).join('') || '<p class="empty-state">No published reports.</p>';
    const photoMarkup = await Promise.all((photos.data || []).map(async (item) => {
      const url = await signedUrl('member-media', item.image_path);
      return url ? `<div class="gallery-item"><img src="${e(url)}" alt="Your uploaded photo"></div>` : '';
    }));
    document.getElementById('personal-photos').innerHTML = photoMarkup.join('') || '<p class="empty-state">No extra photos uploaded yet.</p>';

    onSubmit('member-gallery-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.elements.photo.files[0];
      if (!file) return showStatus('Choose a photo first.', 'danger');
      const uploaded = await uploadFile('member-media', file, session.user.id, 'gallery');
      if (uploaded.error) return showStatus(uploaded.error, 'danger');
      const { error: photoError } = await supabase.from('member_photos').insert({ user_id: session.user.id, image_path: uploaded.path });
      if (photoError) return fail(photoError);
      const { error: galleryError } = await supabase.from('gallery_photos').insert({ uploader_id: session.user.id, source_type: 'member', source_id: session.user.id, image_path: uploaded.path, caption: 'Member photo' });
      if (galleryError) return fail(galleryError);
      showStatus('Photo added to your gallery.', 'success');
      form.reset();
      const photoUrl = await signedUrl('member-media', uploaded.path);
      const photoItem = document.createElement('div');
      photoItem.className = 'gallery-item';
      photoItem.innerHTML = `<img src="${e(photoUrl)}" alt="Your uploaded photo">`;
      document.getElementById('personal-photos').prepend(photoItem);
    });
  }

  async function loadPrayerDirector() {
    const session = await guard('prayer_director');
    if (!session) return;
    const today = localDate();
    const verseTarget = document.getElementById('today-verse');
    const pointTarget = document.getElementById('director-prayer-points');
    const [verseResult, pointsResult] = await Promise.all([
      supabase.from('daily_verses').select('verse_text').eq('posted_on', today).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_prayer_points').select('id,prayer_point,created_at').eq('prayer_date', today).order('created_at', { ascending: false })
    ]);
    if (verseResult.error) fail(verseResult.error);
    if (pointsResult.error) fail(pointsResult.error);
    verseTarget.textContent = verseResult.data?.verse_text || 'No verse has been published for today.';
    pointTarget.innerHTML = (pointsResult.data || []).map((item) => `<li>${e(item.prayer_point)}</li>`).join('') || '<li class="empty-state">No prayer points added yet.</li>';

    onSubmit('prayer-verse-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const existing = await supabase.from('daily_verses').select('id').eq('posted_on', today).limit(1).maybeSingle();
      if (existing.error) return fail(existing.error);
      const result = existing.data
        ? await supabase.from('daily_verses').update({ verse_text: values.verse_text }).eq('id', existing.data.id)
        : await supabase.from('daily_verses').insert({ member_id: session.user.id, verse_text: values.verse_text, posted_on: today });
      if (result.error) return fail(result.error);
      verseTarget.textContent = values.verse_text;
      form.reset();
      showStatus("Today's verse has been published.", 'success');
    });
    onSubmit('prayer-point-form', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formData(form);
      const { data, error } = await supabase.from('daily_prayer_points').insert({ prayer_point: values.prayer_point, prayer_date: today, created_by: session.user.id }).select('id,prayer_point').single();
      if (error) return fail(error);
      const item = document.createElement('li');
      item.textContent = data.prayer_point;
      pointTarget.prepend(item);
      form.reset();
      showStatus('Prayer point added.', 'success');
    });
  }

  async function loadGallery() {
    const session = await guard();
    if (!session) return;
    const target = document.getElementById('gallery-grid');
    const { data: photos, error } = await supabase.from('gallery_photos').select('*').order('created_at', { ascending: false });
    if (error) return fail(error, 'The gallery could not be loaded.');
    if (!photos?.length) return showEmpty(target, 'No photos uploaded yet.');
    const authors = await profileNameMap(photos.map((item) => item.uploader_id));
    const [likesResult, commentsResult, commentLikesResult] = await Promise.all([
      supabase.from('gallery_photo_likes').select('*'),
      supabase.from('gallery_comments').select('*').order('created_at'),
      supabase.from('gallery_comment_likes').select('*')
    ]);
    if (likesResult.error) fail(likesResult.error);
    if (commentsResult.error) fail(commentsResult.error);
    if (commentLikesResult.error) fail(commentLikesResult.error);
    const likes = likesResult.data || [];
    const comments = commentsResult.data || [];
    const commentLikes = commentLikesResult.data || [];
    const commentAuthors = await profileNameMap(comments.map((comment) => comment.user_id));
    const cards = await Promise.all(photos.map(async (photo) => {
      const url = await signedUrl(photo.source_type === 'event' ? 'event-media' : 'member-media', photo.image_path);
      if (!url) return '';
      const photoComments = comments.filter((item) => item.photo_id === photo.id);
      const topLevel = photoComments.filter((item) => !item.parent_comment_id);
      return `<article class="gallery-card"><img class="gallery-photo" src="${e(url)}" alt="${e(photo.caption || 'Gallery photo')}"><div class="gallery-body"><div class="gallery-meta-row"><div><strong>${e(authors[photo.uploader_id] || 'Team member')}</strong><br><small>${e(dateTime(photo.created_at))}</small></div><div class="gallery-share-wrap"><button type="button" class="small-link" data-share="${e(url)}">Share</button><button type="button" class="small-link" data-copy="${e(url)}">Copy link</button></div></div>${photo.caption ? `<p class="gallery-caption">${e(photo.caption)}</p>` : ''}<div class="gallery-actions"><button class="btn btn-secondary" type="button" data-like-photo="${e(photo.id)}">${likes.some((like) => like.photo_id === photo.id && like.user_id === session.user.id) ? 'Unlike' : 'Like'}</button><span>${likes.filter((like) => like.photo_id === photo.id).length} likes</span></div><div class="comments-box"><h3>Comments (${photoComments.length})</h3>${topLevel.map((comment) => `<div class="comment-item"><div class="comment-header"><strong>${e(commentAuthors[comment.user_id] || 'Team member')}</strong><small>${e(dateTime(comment.created_at))}</small></div><p>${e(comment.comment)}</p><button class="small-link" type="button" data-like-comment="${e(comment.id)}">${commentLikes.some((like) => like.comment_id === comment.id && like.user_id === session.user.id) ? 'Unlike' : `Like (${commentLikes.filter((like) => like.comment_id === comment.id).length})`}</button>${photoComments.filter((reply) => reply.parent_comment_id === comment.id).map((reply) => `<div class="reply-item"><strong>${e(commentAuthors[reply.user_id] || 'Team member')}</strong><p>${e(reply.comment)}</p></div>`).join('')}<form class="reply-form" data-reply-form="${e(photo.id)}" data-parent-id="${e(comment.id)}"><textarea name="reply" rows="2" placeholder="Write a reply..." required></textarea><button type="submit" class="btn btn-primary">Reply</button></form></div>`).join('') || '<p class="empty-state">No comments yet.</p>'}<form class="comment-form" data-comment-form="${e(photo.id)}"><textarea name="comment" rows="2" placeholder="Write a comment..." required></textarea><button type="submit" class="btn btn-primary">Comment</button></form></div></div></article>`;
    }));
    target.innerHTML = cards.join('');
    const bindToggle = async (table, key, button) => {
      const id = button.dataset[key === 'photo_id' ? 'likePhoto' : 'likeComment'];
      const exists = await supabase.from(table).select('id').eq(key, id).eq('user_id', session.user.id).maybeSingle();
      if (exists.error) return fail(exists.error);
      const result = exists.data
        ? await supabase.from(table).delete().eq('id', exists.data.id)
        : await supabase.from(table).insert({ [key]: id, user_id: session.user.id });
      if (result.error) return fail(result.error);
      await loadGallery();
    };
    document.querySelectorAll('[data-like-photo]').forEach((button) => button.addEventListener('click', () => bindToggle('gallery_photo_likes', 'photo_id', button)));
    document.querySelectorAll('[data-like-comment]').forEach((button) => button.addEventListener('click', () => bindToggle('gallery_comment_likes', 'comment_id', button)));
    document.querySelectorAll('[data-comment-form], [data-reply-form]').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = formData(form);
      const row = { photo_id: form.dataset.commentForm || form.dataset.replyForm, user_id: session.user.id, comment: data.comment || data.reply, parent_comment_id: form.dataset.parentId || null };
      const { error: insertError } = await supabase.from('gallery_comments').insert(row);
      if (insertError) return fail(insertError);
      await loadGallery();
    }));
    document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(button.dataset.copy); showStatus('Link copied.', 'success'); }
      catch { showStatus('Could not access the clipboard.', 'danger'); }
    }));
    document.querySelectorAll('[data-share]').forEach((button) => button.addEventListener('click', async () => {
      try { if (navigator.share) await navigator.share({ title: 'Praise Team Gallery', url: button.dataset.share }); else await navigator.clipboard.writeText(button.dataset.share); }
      catch { /* User cancelled the share sheet. */ }
    }));
  }

  async function handleGalleryUpload() {
    const session = await guard();
    if (!session) return;
    const form = document.getElementById('gallery-upload-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = form.elements.photo.files[0];
      if (!file) return showStatus('Choose a photo first.', 'danger');
      const uploaded = await uploadFile('member-media', file, session.user.id, 'gallery');
      if (uploaded.error) return showStatus(uploaded.error, 'danger');
      const { error } = await supabase.from('gallery_photos').insert({ uploader_id: session.user.id, source_type: 'member', source_id: session.user.id, image_path: uploaded.path, caption: form.elements.caption.value.trim() || null });
      if (error) return fail(error);
      form.reset();
      showStatus('Photo added to the team gallery.', 'success');
      await loadGallery();
    });
  }

  async function loadSearch() {
    if (!supabase) return;
    const input = document.getElementById('search-query');
    const resultsTarget = document.getElementById('search-results');
    const performSearch = async (query) => {
      const normalized = query.trim();
      if (normalized.length < 2) return showStatus('Enter at least two characters.', 'danger');
      const value = escapeQuery(normalized);
      const pattern = `%${value}%`;
      const [events, updates, reports] = await Promise.all([
        supabase.from('events_public').select('title,description,event_date').or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(30),
        supabase.from('updates_public').select('title,content,published_at').or(`title.ilike.${pattern},content.ilike.${pattern}`).limit(30),
        supabase.from('department_reports_public').select('title,summary,published_at').or(`title.ilike.${pattern},summary.ilike.${pattern}`).limit(30)
      ]);
      for (const result of [events, updates, reports]) if (result.error) fail(result.error);
      const merged = [
        ...(events.data || []).map((item) => ({ type: 'Event', title: item.title, excerpt: item.description, date: item.event_date })),
        ...(updates.data || []).map((item) => ({ type: 'Update', title: item.title, excerpt: item.content, date: item.published_at })),
        ...(reports.data || []).map((item) => ({ type: 'Report', title: item.title, excerpt: item.summary, date: item.published_at }))
      ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 30);
      if (!merged.length) return showEmpty(resultsTarget, 'No public results found.');
      resultsTarget.innerHTML = `<p>${merged.length} result(s) for &quot;${e(normalized)}&quot;</p>${merged.map((item) => `<article class="search-result"><span class="badge">${e(item.type)}</span><h2>${e(item.title)}</h2><p>${e(item.excerpt || '')}</p><small>Last updated: ${e(dateTime(item.date))}</small></article>`).join('')}`;
    };
    document.getElementById('search-form')?.addEventListener('submit', (event) => { event.preventDefault(); performSearch(input.value); });
    const query = new URLSearchParams(window.location.search).get('q') || '';
    input.value = query;
    if (query) performSearch(query);
  }

  async function loadMemberGallery() {
    const session = await guard();
    if (!session) return;
    const { data, error } = await supabase.from('member_photos').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (error) return fail(error);
    const target = document.getElementById('personal-photos');
    const photos = await Promise.all((data || []).map(async (photo) => {
      const url = await signedUrl('member-media', photo.image_path);
      return url ? `<div class="gallery-item"><img src="${e(url)}" alt="Your uploaded photo"></div>` : '';
    }));
    target.innerHTML = photos.join('') || '<p class="empty-state">No extra photos uploaded yet.</p>';
  }

  const dispatch = {
    home: loadHome,
    login: handleLogin,
    logout: handleLogout,
    'set-password': handleSetPassword,
    dashboard: async () => { const session = await guard(); if (session) window.location.replace(redirectForRole(session.role)); },
    members: loadMembers,
    chair: loadChair,
    'chair-members': loadChairMembers,
    secretary: loadSecretary,
    'music-director': loadMusicDirector,
    'band-director': loadBandDirector,
    member: loadMember,
    'prayer-director': loadPrayerDirector,
    gallery: async () => { await handleGalleryUpload(); await loadGallery(); },
    search: loadSearch,
    'member-gallery': loadMemberGallery,
    setup: async () => { if (!supabase) return; const session = await getSession(); if (session.user) window.location.replace(redirectForRole(session.role)); }
  };

  if (dispatch[page]) dispatch[page]().catch((error) => fail(error));
})();