(() => {
  'use strict';

  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('admin-password');
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const loginError = document.getElementById('login-error');

  const telegramStatusPill = document.getElementById('telegram-status-pill');
  const refreshBtn = document.getElementById('refresh-btn');
  const testTgBtn = document.getElementById('test-tg-btn');
  const logoutBtn = document.getElementById('logout-btn');

  const statTotalGuests = document.getElementById('stat-total-guests');
  const statAttending = document.getElementById('stat-attending');
  const statTotalResponses = document.getElementById('stat-total-responses');
  const statDeclined = document.getElementById('stat-declined');
  const statWishes = document.getElementById('stat-wishes');
  const statUpdatedAt = document.getElementById('stat-updated-at');

  const tabRsvpsBtn = document.getElementById('tab-rsvps');
  const tabWishesBtn = document.getElementById('tab-wishes');
  const tabRsvpsCount = document.getElementById('tab-rsvps-count');
  const tabWishesCount = document.getElementById('tab-wishes-count');
  const panelRsvps = document.getElementById('panel-rsvps');
  const panelWishes = document.getElementById('panel-wishes');

  const rsvpSearchInput = document.getElementById('rsvp-search');
  const wishSearchInput = document.getElementById('wish-search');
  const filterBtns = Array.from(document.querySelectorAll('.pill-btn[data-filter]'));
  const rsvpTbody = document.getElementById('rsvp-tbody');
  const rsvpEmpty = document.getElementById('rsvp-empty');
  const wishesGrid = document.getElementById('wishes-grid');
  const wishesEmpty = document.getElementById('wishes-empty');

  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmOkBtn = document.getElementById('confirm-ok-btn');
  const toastContainer = document.getElementById('toast-container');

  // Keep auth CSRF token and data strictly in memory (never in localStorage/sessionStorage)
  let csrfToken = '';
  let currentData = {
    rsvpSummary: {
      totalResponses: 0,
      attendingResponses: 0,
      declinedResponses: 0,
      totalAttendingGuests: 0
    },
    rsvps: [],
    wishes: []
  };
  let activeRsvpFilter = 'all';
  let pendingDeleteAction = null;

  function showToast(message, isError = false) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = isError ? 'toast toast-error' : 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  function showLoginError(message) {
    if (!loginError) return;
    if (!message) {
      loginError.textContent = '';
      loginError.classList.add('hidden');
      return;
    }
    loginError.textContent = message;
    loginError.classList.remove('hidden');
  }

  function setView(authenticated) {
    if (authenticated) {
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
    } else {
      dashboardView.classList.add('hidden');
      loginView.classList.remove('hidden');
      currentData = {
        rsvpSummary: {
          totalResponses: 0,
          attendingResponses: 0,
          declinedResponses: 0,
          totalAttendingGuests: 0
        },
        rsvps: [],
        wishes: []
      };
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    }
  }

  function updateTelegramStatus(configured) {
    if (!telegramStatusPill) return;
    if (configured) {
      telegramStatusPill.textContent = 'Telegram: Đã kết nối';
      telegramStatusPill.classList.add('ok');
    } else {
      telegramStatusPill.textContent = 'Telegram: Chưa cấu hình';
      telegramStatusPill.classList.remove('ok');
    }
  }

  async function apiGet(url) {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'Lỗi phản hồi máy chủ.' }));
    return { status: res.status, data };
  }

  async function apiPost(url, bodyObj = {}) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify(bodyObj)
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'Lỗi phản hồi máy chủ.' }));
    return { status: res.status, data };
  }

  function renderStats() {
    const s = currentData.rsvpSummary || {};
    statTotalGuests.textContent = String(s.totalAttendingGuests || 0);
    statAttending.textContent = String(s.attendingResponses || 0);
    statTotalResponses.textContent = `${s.totalResponses || 0} phản hồi RSVP`;
    statDeclined.textContent = String(s.declinedResponses || 0);
    statWishes.textContent = String(currentData.wishes.length);

    tabRsvpsCount.textContent = String(currentData.rsvps.length);
    tabWishesCount.textContent = String(currentData.wishes.length);

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    statUpdatedAt.textContent = `Cập nhật lúc ${hh}:${mm}:${ss}`;
  }

  function openConfirmModal(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    pendingDeleteAction = onConfirm;
    confirmDialog.showModal();
  }

  function renderRsvps() {
    rsvpTbody.replaceChildren();
    const q = (rsvpSearchInput.value || '').trim().toLowerCase();

    const filtered = currentData.rsvps.filter((item) => {
      if (activeRsvpFilter === 'yes' && item.attending !== 'yes') return false;
      if (activeRsvpFilter === 'no' && item.attending === 'yes') return false;
      if (!q) return true;
      const hay = `${item.name || ''} ${item.note || ''}`.toLowerCase();
      return hay.includes(q);
    });

    rsvpEmpty.classList.toggle('hidden', filtered.length > 0);

    filtered.forEach((item) => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.className = 'guest-name';
      tdName.textContent = item.name || '';
      tr.appendChild(tdName);

      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      const isYes = item.attending === 'yes';
      badge.className = isYes ? 'badge badge-yes' : 'badge badge-no';
      badge.textContent = isYes ? 'Đồng ý tham dự' : 'Báo bận';
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      const tdGuests = document.createElement('td');
      tdGuests.textContent = isYes ? `${Number(item.guests) || 1} người` : '0';
      tr.appendChild(tdGuests);

      const tdNote = document.createElement('td');
      tdNote.className = 'note-text';
      tdNote.textContent = item.note ? item.note : '—';
      tr.appendChild(tdNote);

      const tdTime = document.createElement('td');
      tdTime.className = 'time-text';
      tdTime.textContent = item.time || '';
      tr.appendChild(tdTime);

      const tdAction = document.createElement('td');
      tdAction.className = 'cell-action';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-icon-danger';
      delBtn.textContent = 'Xóa';
      delBtn.addEventListener('click', () => {
        openConfirmModal(
          'Xóa xác nhận tham dự',
          `Bạn có chắc muốn xóa phản hồi RSVP của "${item.name || ''}" không?`,
          async () => {
            const { status, data } = await apiPost('/api/admin/rsvps/delete', { id: item.id });
            if (status === 401) {
              setView(false);
              showToast('Phiên đăng nhập đã hết hạn.', true);
              return;
            }
            if (!data.ok) {
              showToast(data.error || 'Không thể xóa bản ghi.', true);
              return;
            }
            currentData.rsvps = Array.isArray(data.rsvps) ? data.rsvps : [];
            currentData.rsvpSummary = data.summary || currentData.rsvpSummary;
            renderStats();
            renderRsvps();
            showToast('Đã xóa bản ghi RSVP.');
          }
        );
      });
      tdAction.appendChild(delBtn);
      tr.appendChild(tdAction);

      rsvpTbody.appendChild(tr);
    });
  }

  function renderWishes() {
    wishesGrid.replaceChildren();
    const q = (wishSearchInput.value || '').trim().toLowerCase();

    const filtered = currentData.wishes.filter((item) => {
      if (!q) return true;
      const hay = `${item.name || ''} ${item.message || ''}`.toLowerCase();
      return hay.includes(q);
    });

    wishesEmpty.classList.toggle('hidden', filtered.length > 0);

    filtered.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'wish-card';

      const header = document.createElement('div');
      header.className = 'wish-header';

      const author = document.createElement('span');
      author.className = 'wish-author';
      author.textContent = item.name || '';
      header.appendChild(author);

      const time = document.createElement('span');
      time.className = 'time-text';
      time.textContent = item.time || '';
      header.appendChild(time);

      const body = document.createElement('p');
      body.className = 'wish-body';
      body.textContent = item.message || '';

      const footer = document.createElement('div');
      footer.className = 'wish-footer';

      const idLabel = document.createElement('span');
      idLabel.className = 'time-text';
      idLabel.textContent = item.id || '';
      footer.appendChild(idLabel);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-icon-danger';
      delBtn.textContent = 'Xóa lời chúc';
      delBtn.addEventListener('click', () => {
        openConfirmModal(
          'Xóa lời chúc',
          `Bạn có chắc muốn xóa lời chúc của "${item.name || ''}" không?`,
          async () => {
            const { status, data } = await apiPost('/api/admin/wishes/delete', { id: item.id });
            if (status === 401) {
              setView(false);
              showToast('Phiên đăng nhập đã hết hạn.', true);
              return;
            }
            if (!data.ok) {
              showToast(data.error || 'Không thể xóa lời chúc.', true);
              return;
            }
            currentData.wishes = Array.isArray(data.wishes) ? data.wishes : [];
            renderStats();
            renderWishes();
            showToast('Đã xóa lời chúc.');
          }
        );
      });
      footer.appendChild(delBtn);

      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);
      wishesGrid.appendChild(card);
    });
  }

  async function loadSubmissions() {
    refreshBtn.disabled = true;
    try {
      const { status, data } = await apiGet('/api/submissions');
      if (status === 401) {
        setView(false);
        await initSession();
        return;
      }
      if (!data.ok) {
        showToast(data.error || 'Không thể tải dữ liệu.', true);
        return;
      }
      currentData = {
        rsvpSummary: data.rsvpSummary || {
          totalResponses: 0,
          attendingResponses: 0,
          declinedResponses: 0,
          totalAttendingGuests: 0
        },
        rsvps: Array.isArray(data.rsvps) ? data.rsvps : [],
        wishes: Array.isArray(data.wishes) ? data.wishes : []
      };
      renderStats();
      renderRsvps();
      renderWishes();
    } catch (_) {
      showToast('Lỗi kết nối máy chủ.', true);
    } finally {
      refreshBtn.disabled = false;
    }
  }

  async function initSession() {
    try {
      const { data } = await apiGet('/api/admin/session');
      if (data && data.ok) {
        csrfToken = data.csrfToken || '';
        if (data.authenticated) {
          updateTelegramStatus(Boolean(data.telegramConfigured));
          setView(true);
          await loadSubmissions();
          return;
        }
      }
      setView(false);
    } catch (_) {
      setView(false);
      showLoginError('Không thể kết nối tới máy chủ.');
    }
  }

  // Neutralize spreadsheet formula injection when exporting CSV
  function csvCell(value) {
    let s = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(s)) {
      s = `'${s}`;
    }
    return `"${s.replace(/"/g, '""')}"`;
  }

  function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  togglePasswordBtn?.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePasswordBtn.textContent = isHidden ? 'Ẩn' : 'Hiện';
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoginError('');
    const password = passwordInput.value;
    if (!password) {
      showLoginError('Vui lòng nhập mật khẩu.');
      return;
    }

    loginSubmitBtn.disabled = true;
    try {
      const { data } = await apiPost('/api/admin/login', { password });
      if (!data.ok) {
        showLoginError(data.error || 'Đăng nhập thất bại.');
        return;
      }
      csrfToken = data.csrfToken || '';
      passwordInput.value = '';
      updateTelegramStatus(Boolean(data.telegramConfigured));
      setView(true);
      showToast('Đăng nhập thành công.');
      await loadSubmissions();
    } catch (_) {
      showLoginError('Lỗi kết nối khi đăng nhập.');
    } finally {
      loginSubmitBtn.disabled = false;
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    try {
      await apiPost('/api/admin/logout', {});
    } catch (_) {}
    csrfToken = '';
    setView(false);
    // Full reload clears any transient UI state
    window.location.replace('/admin');
  });

  refreshBtn?.addEventListener('click', () => {
    loadSubmissions().then(() => showToast('Đã cập nhật dữ liệu mới nhất.'));
  });

  testTgBtn?.addEventListener('click', async () => {
    testTgBtn.disabled = true;
    try {
      const { status, data } = await apiPost('/api/admin/test-telegram', {});
      if (status === 401) {
        setView(false);
        showToast('Phiên đăng nhập đã hết hạn.', true);
        return;
      }
      if (!data.ok) {
        showToast(data.error || 'Gửi thử Telegram thất bại.', true);
      } else {
        showToast(data.message || 'Đã gửi tin nhắn kiểm tra tới Telegram!');
      }
    } catch (_) {
      showToast('Lỗi kết nối khi test Telegram.', true);
    } finally {
      testTgBtn.disabled = false;
    }
  });

  tabRsvpsBtn?.addEventListener('click', () => {
    tabRsvpsBtn.classList.add('active');
    tabRsvpsBtn.setAttribute('aria-selected', 'true');
    tabWishesBtn.classList.remove('active');
    tabWishesBtn.setAttribute('aria-selected', 'false');
    panelRsvps.classList.remove('hidden');
    panelWishes.classList.add('hidden');
  });

  tabWishesBtn?.addEventListener('click', () => {
    tabWishesBtn.classList.add('active');
    tabWishesBtn.setAttribute('aria-selected', 'true');
    tabRsvpsBtn.classList.remove('active');
    tabRsvpsBtn.setAttribute('aria-selected', 'false');
    panelWishes.classList.remove('hidden');
    panelRsvps.classList.add('hidden');
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeRsvpFilter = btn.dataset.filter || 'all';
      filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
      renderRsvps();
    });
  });

  rsvpSearchInput?.addEventListener('input', renderRsvps);
  wishSearchInput?.addEventListener('input', renderWishes);

  exportCsvBtn?.addEventListener('click', () => {
    const header = ['STT', 'Khách mời', 'Trạng thái', 'Số khách', 'Lời nhắn', 'Thời gian'];
    const rows = currentData.rsvps.map((r, idx) => [
      csvCell(idx + 1),
      csvCell(r.name),
      csvCell(r.attending === 'yes' ? 'Đồng ý tham dự' : 'Báo bận'),
      csvCell(r.attending === 'yes' ? Number(r.guests) || 1 : 0),
      csvCell(r.note || ''),
      csvCell(r.time || '')
    ]);
    // UTF-8 BOM for Excel Vietnamese support
    const csv = '\uFEFF' + [header.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
    triggerDownload('wedding-rsvps.csv', csv, 'text/csv;charset=utf-8');
  });

  exportJsonBtn?.addEventListener('click', () => {
    const json = JSON.stringify(currentData, null, 2);
    triggerDownload('wedding-submissions.json', json, 'application/json;charset=utf-8');
  });

  confirmCancelBtn?.addEventListener('click', () => {
    pendingDeleteAction = null;
    confirmDialog.close();
  });

  confirmOkBtn?.addEventListener('click', async () => {
    const action = pendingDeleteAction;
    pendingDeleteAction = null;
    confirmDialog.close();
    if (typeof action === 'function') {
      await action();
    }
  });

  initSession();
})();
