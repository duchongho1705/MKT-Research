/* ============================================================
   365 ENERGY — Executive Brand Strategy 2026
   app.js — Main Application Module
   
   MODULES:
   1. Firebase Configuration & Init
   2. Tab Manager
   3. Feedback Manager (Firestore real-time)
   4. Edit Manager (Firestore persistence)
   5. UI Helpers (Toast, Modal)
   ============================================================ */

/* ============================================================
   ⚙️  FIREBASE CONFIGURATION
   
   Steps to set up:
   1. Go to https://console.firebase.google.com
   2. Create a new project (or use existing)
   3. Go to Project Settings → Your Apps → Add Web App
   4. Copy the firebaseConfig object values below
   5. Go to Firestore Database → Create Database (Start in TEST mode)
   ============================================================ */
const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyAI_oXIVEyKkmvBNWIAok8J8nAtSBtRl1A",
    authDomain:        "e-hsnl.firebaseapp.com",
    projectId:         "e-hsnl",
    storageBucket:     "e-hsnl.firebasestorage.app",
    messagingSenderId: "854735568018",
    appId:             "1:854735568018:web:7f68ef361a4211d7c97a4b"
};

/* ============================================================
   STATE & CONSTANTS
   ============================================================ */
let db = null;
let currentTab = 'context';
let feedbackUnsub = null; // Active Firestore listener

const TAB_NAMES = {
    context:     '1. Nền Tảng Dữ Liệu',
    competitors: '2. Phân Tích Cạnh Tranh',
    positioning: '3. Hoạch Định Vị Thế',
    profile:     '4. Cấu Trúc HSNL'
};

const AVATAR_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#10b981', '#14b8a6', '#0ea5e9', '#6366f1'
];

const ROLE_CLASS = {
    'Director':    'director',
    'Marketing':   'marketing',
    'Khách hàng':  'khach',
    'Khác':        'other'
};

/* ============================================================
   FIREBASE INIT
   ============================================================ */
function initFirebase() {
    const isConfigured = !FIREBASE_CONFIG.apiKey.includes('YOUR_') && 
                          FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID';

    if (!isConfigured) {
        showFirebaseBanner();
        return false;
    }

    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
        // Enable offline tab sync
        db.enablePersistence({ synchronizeTabs: true })
          .catch(err => {
              if (err.code === 'failed-precondition') {
                  console.warn('[Firebase] Multi-tab persistence unavailable.');
              }
          });
        return true;
    } catch (e) {
        console.error('[Firebase] Init failed:', e);
        showFirebaseBanner();
        return false;
    }
}

function showFirebaseBanner() {
    const banner = document.createElement('div');
    banner.className = 'firebase-banner';
    banner.innerHTML = `
        ⚠️ Firebase chưa được cấu hình. 
        Mở file <strong>app.js</strong>, điền thông tin Firebase vào <code>FIREBASE_CONFIG</code>.
        <a href="https://console.firebase.google.com" target="_blank">Tạo project →</a>
    `;
    document.body.appendChild(banner);
}

/* ============================================================
   UTILS
   ============================================================ */
function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().charAt(0).toUpperCase();
}

function formatTimestamp(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/* ============================================================
   TAB MANAGER
   ============================================================ */
function switchTab(tabId) {
    if (currentTab === tabId) return;
    
    // Cancel edit mode before switching
    if (EditManager.activeTab) EditManager.cancelEdit();

    currentTab = tabId;

    // Update nav button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-emerald-500/20', 'text-emerald-50', 'border-emerald-500/30');
        btn.classList.add('text-emerald-100/70', 'hover:bg-emerald-500/10', 'hover:text-emerald-50', 'border-transparent');
    });

    const activeBtn = document.querySelector(`[data-target="${tabId}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('text-emerald-100/70', 'hover:bg-emerald-500/10', 'hover:text-emerald-50', 'border-transparent');
        activeBtn.classList.add('bg-emerald-500/20', 'text-emerald-50', 'border-emerald-500/30');
    }

    // Animate out current tab
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.classList.contains('active') && content.id !== tabId) {
            content.style.opacity = '0';
            content.style.transform = 'translateY(15px)';
            setTimeout(() => {
                content.classList.remove('active');
                content.style.display = 'none';
            }, 300);
        }
    });

    // Animate in target tab
    setTimeout(() => {
        const target = document.getElementById(tabId);
        if (target && !target.classList.contains('active')) {
            target.style.display = 'block';
            requestAnimationFrame(() => {
                target.classList.add('active');
                target.style.opacity = '1';
                target.style.transform = 'translateY(0)';
            });
        }
        EditManager.applyEdits(tabId);
    }, 300);

    // If panel is open, switch its content
    if (document.getElementById('feedback-panel').classList.contains('open')) {
        FeedbackManager.openPanel(tabId);
    }
}

/* ============================================================
   FEEDBACK MANAGER
   ============================================================ */
const FeedbackManager = {
    openPanel(tabId) {
        currentTab = tabId;
        document.getElementById('fp-tab-name').textContent = TAB_NAMES[tabId] || tabId;
        document.getElementById('feedback-panel').classList.add('open');
        document.body.style.overflow = 'hidden';
        this._subscribe(tabId);
    },

    closePanel() {
        document.getElementById('feedback-panel').classList.remove('open');
        document.body.style.overflow = '';
        if (feedbackUnsub) { feedbackUnsub(); feedbackUnsub = null; }
    },

    _subscribe(tabId) {
        if (feedbackUnsub) { feedbackUnsub(); feedbackUnsub = null; }
        if (!db) { this._renderError(); return; }

        const collectionId = `feedback_${tabId}`;
        feedbackUnsub = db.collection(collectionId)
            .orderBy('timestamp', 'asc')
            .onSnapshot(
                snap => {
                    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    this._renderList(items);
                    this._updateBadges(tabId, items);
                },
                err => {
                    console.error('[Feedback] Listener error:', err);
                    this._renderError();
                }
            );
    },

    _renderList(items) {
        const list = document.getElementById('feedback-list');
        if (!list) return;

        if (items.length === 0) {
            list.innerHTML = `
                <div class="feedback-empty">
                    <div class="feedback-empty-icon">💬</div>
                    <p style="font-weight:700;color:#64748b;margin-bottom:0.3rem;">Chưa có góp ý nào</p>
                    <p style="font-size:0.8125rem;color:#94a3b8;">Nhấn "Thêm Góp Ý Mới" để bắt đầu.</p>
                </div>`;
            return;
        }

        list.innerHTML = items.map(item => {
            const roleClass = ROLE_CLASS[item.role] || 'other';
            const avatarColor = getAvatarColor(item.author || '?');
            const initials = getInitials(item.author || '?');
            const time = formatTimestamp(item.timestamp);
            const resolved = item.resolved;

            return `
            <div class="feedback-item ${resolved ? 'resolved' : ''}">
                <div class="fi-header">
                    <div class="fi-user">
                        <div class="fi-avatar" style="background:${avatarColor}">${initials}</div>
                        <div>
                            <div class="fi-name">${escapeHtml(item.author)}</div>
                            <div class="fi-role ${roleClass}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                ${escapeHtml(item.role)}
                            </div>
                        </div>
                    </div>
                    <div class="fi-actions">
                        <button class="fi-btn resolve ${resolved ? 'resolved-mark' : ''}"
                                onclick="FeedbackManager.toggleResolve('${item.id}', ${resolved})"
                                title="${resolved ? 'Đã xử lý – nhấn để bỏ đánh dấu' : 'Đánh dấu đã xử lý'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button class="fi-btn delete"
                                onclick="FeedbackManager.deleteItem('${item.id}')"
                                title="Xoá góp ý">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                    </div>
                </div>
                <p class="fi-text">${escapeHtml(item.text)}</p>
                <div class="fi-time">${time}</div>
            </div>`;
        }).join('');
    },

    _renderError() {
        const list = document.getElementById('feedback-list');
        if (!list) return;
        list.innerHTML = `
            <div class="feedback-empty">
                <div class="feedback-empty-icon">⚙️</div>
                <p style="font-weight:700;color:#64748b;margin-bottom:0.3rem;">Firebase chưa kết nối</p>
                <p style="font-size:0.8125rem;color:#94a3b8;">Điền thông tin Firebase vào <strong>app.js</strong> để bắt đầu.</p>
            </div>`;
    },

    _updateBadges(tabId, items) {
        const total   = items.length;
        const pending = items.filter(i => !i.resolved).length;

        // Panel header badges
        const countBadge   = document.getElementById('fp-badge-count');
        const pendingBadge = document.getElementById('fp-badge-pending');
        if (countBadge)   countBadge.textContent   = `${total} góp ý`;
        if (pendingBadge) {
            pendingBadge.textContent  = `${pending} chờ`;
            pendingBadge.style.display = pending > 0 ? 'inline-flex' : 'none';
        }

        // Button badge
        const badge = document.getElementById(`badge-${tabId}`);
        if (badge) {
            badge.textContent = total;
            badge.classList.toggle('has-items', total > 0);
        }
    },

    // Watch all tabs' counts for the sidebar badges
    watchAllCounts() {
        if (!db) return;
        Object.keys(TAB_NAMES).forEach(tabId => {
            db.collection(`feedback_${tabId}`)
              .onSnapshot(snap => {
                  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                  this._updateBadges(tabId, items);
              }, () => {});
        });
    },

    async addFeedback(tabId, author, role, text) {
        if (!db) { showToast('Firebase chưa được cấu hình', 'error'); return false; }
        try {
            await db.collection(`feedback_${tabId}`).add({
                author: author.trim(),
                role,
                text: text.trim(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                resolved: false
            });
            showToast('✅ Đã gửi góp ý thành công!', 'success');
            return true;
        } catch (e) {
            console.error('[Feedback] Add error:', e);
            showToast('Lỗi khi gửi góp ý. Thử lại!', 'error');
            return false;
        }
    },

    async toggleResolve(id, currentState) {
        if (!db) return;
        try {
            await db.collection(`feedback_${currentTab}`).doc(id).update({
                resolved: !currentState
            });
        } catch (e) {
            console.error('[Feedback] Resolve error:', e);
            showToast('Lỗi cập nhật trạng thái', 'error');
        }
    },

    async deleteItem(id) {
        if (!db) return;
        if (!confirm('Xoá góp ý này?')) return;
        try {
            await db.collection(`feedback_${currentTab}`).doc(id).delete();
            showToast('Đã xoá góp ý', 'info');
        } catch (e) {
            console.error('[Feedback] Delete error:', e);
            showToast('Lỗi khi xoá góp ý', 'error');
        }
    }
};

/* ============================================================
   FEEDBACK MODAL
   ============================================================ */
const FeedbackModal = {
    open() {
        document.getElementById('modal-overlay').classList.add('open');
        setTimeout(() => document.getElementById('fb-author').focus(), 200);
    },

    close() {
        document.getElementById('modal-overlay').classList.remove('open');
        document.getElementById('fb-author').value  = '';
        document.getElementById('fb-role').value    = 'Marketing';
        document.getElementById('fb-content').value = '';
        const btn = document.getElementById('btn-modal-submit');
        btn.disabled    = false;
        btn.textContent = 'Gửi Góp Ý →';
    },

    async submit() {
        const author  = document.getElementById('fb-author').value.trim();
        const role    = document.getElementById('fb-role').value;
        const text    = document.getElementById('fb-content').value.trim();

        if (!author) { document.getElementById('fb-author').focus(); return; }
        if (!text)   { document.getElementById('fb-content').focus(); return; }

        const btn = document.getElementById('btn-modal-submit');
        btn.disabled    = true;
        btn.textContent = 'Đang gửi…';

        const ok = await FeedbackManager.addFeedback(currentTab, author, role, text);
        if (ok) this.close();
        else {
            btn.disabled    = false;
            btn.textContent = 'Gửi Góp Ý →';
        }
    }
};

/* ============================================================
   EDIT MANAGER
   ============================================================ */
const EditManager = {
    activeTab: null,
    originals: {},

    // Apply saved edits from Firestore when loading a tab
    async applyEdits(tabId) {
        if (!db) return;
        try {
            const doc = await db.collection('edits').doc(tabId).get();
            if (!doc.exists) return;
            const data = doc.data();
            if (!data || !data.elements) return;
            const section = document.getElementById(tabId);
            if (!section) return;
            Object.entries(data.elements).forEach(([editId, html]) => {
                const el = section.querySelector(`[data-edit-id="${editId}"]`);
                if (el) el.innerHTML = html;
            });
        } catch (e) {
            console.error('[Edit] Apply error:', e);
        }
    },

    async applyAllEdits() {
        for (const tabId of Object.keys(TAB_NAMES)) {
            await this.applyEdits(tabId);
        }
    },

    toggle(tabId) {
        if (this.activeTab === tabId) {
            this.cancelEdit();
        } else {
            if (this.activeTab) this.cancelEdit();
            this.enterEditMode(tabId);
        }
    },

    enterEditMode(tabId) {
        this.activeTab = tabId;
        const section = document.getElementById(tabId);
        if (!section) return;

        this.originals = {};
        section.querySelectorAll('[data-edit-id]').forEach(el => {
            this.originals[el.dataset.editId] = el.innerHTML;
            el.setAttribute('contenteditable', 'true');
            el.setAttribute('spellcheck', 'false');
        });

        document.getElementById(`edit-toolbar-${tabId}`)?.classList.add('visible');
        document.getElementById(`edit-btn-${tabId}`)?.classList.add('editing');

        showToast('✏️ Chế độ chỉnh sửa đã bật', 'info', 2500);
    },

    cancelEdit() {
        if (!this.activeTab) return;
        const tabId = this.activeTab;
        const section = document.getElementById(tabId);

        if (section) {
            section.querySelectorAll('[data-edit-id]').forEach(el => {
                const orig = this.originals[el.dataset.editId];
                if (orig !== undefined) el.innerHTML = orig;
                el.removeAttribute('contenteditable');
                el.removeAttribute('spellcheck');
            });
        }

        document.getElementById(`edit-toolbar-${tabId}`)?.classList.remove('visible');
        document.getElementById(`edit-btn-${tabId}`)?.classList.remove('editing');

        this.activeTab  = null;
        this.originals  = {};
    },

    async saveEdits() {
        if (!this.activeTab) return;
        if (!db) { showToast('Firebase chưa được cấu hình', 'error'); return; }

        const tabId   = this.activeTab;
        const section = document.getElementById(tabId);
        if (!section) return;

        const elements = {};
        section.querySelectorAll('[data-edit-id]').forEach(el => {
            elements[el.dataset.editId] = el.innerHTML;
            el.removeAttribute('contenteditable');
            el.removeAttribute('spellcheck');
        });

        try {
            await db.collection('edits').doc(tabId).set({
                elements,
                tabId,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('💾 Đã lưu chỉnh sửa!', 'success');
        } catch (e) {
            console.error('[Edit] Save error:', e);
            showToast('Lỗi khi lưu. Thử lại!', 'error');
            // Restore contenteditable on error
            section.querySelectorAll('[data-edit-id]').forEach(el => {
                el.setAttribute('contenteditable', 'true');
            });
            return;
        }

        document.getElementById(`edit-toolbar-${tabId}`)?.classList.remove('visible');
        document.getElementById(`edit-btn-${tabId}`)?.classList.remove('editing');
        this.activeTab = null;
        this.originals = {};
    }
};

/* ============================================================
   SIMPLE HTML ESCAPE
   ============================================================ */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    // Icons
    lucide.createIcons();

    // Firebase
    initFirebase();

    // Feedback panel events
    document.getElementById('feedback-backdrop')?.addEventListener('click', () => FeedbackManager.closePanel());
    document.getElementById('fp-close-btn')?.addEventListener('click',      () => FeedbackManager.closePanel());

    // Add feedback button (in panel footer)
    document.getElementById('btn-add-feedback')?.addEventListener('click', () => FeedbackModal.open());

    // Modal events
    document.getElementById('btn-modal-cancel')?.addEventListener('click',  () => FeedbackModal.close());
    document.getElementById('btn-modal-submit')?.addEventListener('click',  () => FeedbackModal.submit());
    document.getElementById('btn-modal-close')?.addEventListener('click',   () => FeedbackModal.close());
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
        if (e.target === document.getElementById('modal-overlay')) FeedbackModal.close();
    });

    // Enter key in modal author field
    document.getElementById('fb-author')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('fb-content').focus();
    });

    // Ctrl/Cmd + Enter to submit modal
    document.getElementById('modal-overlay')?.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') FeedbackModal.submit();
    });

    // Escape key closes panel/modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (document.getElementById('modal-overlay')?.classList.contains('open')) {
                FeedbackModal.close();
            } else if (document.getElementById('feedback-panel')?.classList.contains('open')) {
                FeedbackManager.closePanel();
            } else if (EditManager.activeTab) {
                EditManager.cancelEdit();
            }
        }
    });

    // Background badge watchers for all tabs
    FeedbackManager.watchAllCounts();

    // Apply persisted edits
    EditManager.applyAllEdits();
});
