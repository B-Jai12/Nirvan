import { useState, useEffect } from 'react';
import { auth, db } from '../firebase.js';
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import './MyCirclePage.css';

// Derive initials from full name
const toInitials = (name) =>
  name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

// Soft avatar color from string
const COLORS = ['#C4998A','#6B8C72','#A07CA0','#7A8EA0','#C4A46A','#A08A6A'];
const avatarColor = (str) => COLORS[str.charCodeAt(0) % COLORS.length];

export default function MyCirclePage() {
  const [contacts, setContacts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId,    setEditId]   = useState(null);
  const [form, setForm] = useState({ name: '', relation: '', phone: '', email: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ── Firestore real-time listener ──────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'users', uid, 'contacts'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setContacts(docs);
      // Keep localStorage in sync for GuardianCard SMS
      localStorage.setItem('nirvan_contacts', JSON.stringify(docs));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, []);

  // ── Open / close modal ────────────────────────────────────
  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', relation: '', phone: '', email: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditId(c.id);
    setForm({ name: c.name, relation: c.relation, phone: c.phone || '', email: c.email || '' });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditId(null); };

  // ── Save contact ──────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())     { setFormError('Name is required.'); return; }
    if (!form.relation.trim()) { setFormError('Relation is required.'); return; }
    if (!form.phone.trim() && !form.email.trim()) {
      setFormError('Add at least a phone number or email.'); return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) { setFormError('Not signed in.'); return; }

    setSaving(true);
    try {
      const payload = {
        name:     form.name.trim(),
        relation: form.relation.trim(),
        phone:    form.phone.trim(),
        email:    form.email.trim(),
        initials: toInitials(form.name),
        createdAt: serverTimestamp(),
      };

      if (editId) {
        // Update — deleteDoc + re-add keeps ordering simple
        await deleteDoc(doc(db, 'users', uid, 'contacts', editId));
        await addDoc(collection(db, 'users', uid, 'contacts'), payload);
      } else {
        await addDoc(collection(db, 'users', uid, 'contacts'), payload);
      }
      closeModal();
    } catch (err) {
      setFormError('Failed to save. Check your connection.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete contact ────────────────────────────────────────
  const handleDelete = async (id) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'users', uid, 'contacts', id));
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="mc-page">
      <div className="mc-section-label">Your Guardian Circle</div>

      {loading && (
        <div className="mc-loading">
          <div className="mc-loading-spinner" />
          <span>Loading contacts…</span>
        </div>
      )}

      {!loading && (
        <div className="mc-contact-list">
          {contacts.length === 0 && (
            <div className="mc-empty">
              <span>👥</span>
              <p>No guardians yet. Add someone who can help you in an emergency.</p>
            </div>
          )}

          {contacts.map((c) => (
            <div key={c.id} className="mc-card">
              <div
                className="mc-avatar"
                style={{ background: avatarColor(c.name) }}
              >
                {c.initials || toInitials(c.name)}
              </div>

              <div className="mc-card-body">
                <div className="mc-card-top">
                  <div>
                    <span className="mc-name">{c.name}</span>
                    <span className="mc-relation"> · {c.relation}</span>
                  </div>
                  <div className="mc-card-actions">
                    <button
                      className="mc-action-btn mc-action-btn--edit"
                      onClick={() => openEdit(c)}
                      title="Edit"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                        <path d="M11 2l3 3-8 8H3v-3l8-8z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className="mc-action-btn mc-action-btn--delete"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      title="Remove"
                    >
                      {deletingId === c.id ? '…' : (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mc-contact-details">
                  {c.phone && (
                    <span className="mc-detail-chip mc-detail-chip--phone">
                      📞 {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className="mc-detail-chip mc-detail-chip--email">
                      ✉️ {c.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="mc-add-btn" onClick={openAdd}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <path d="M8 3v10M3 8h10" strokeLinecap="round"/>
        </svg>
        Add Guardian
      </button>

      {/* ── Modal ── */}
      {showModal && (
        <div className="mc-modal-backdrop" onClick={closeModal}>
          <div className="mc-modal" onClick={e => e.stopPropagation()}>
            <div className="mc-modal-header">
              <h3 className="mc-modal-title">{editId ? 'Edit Guardian' : 'Add Guardian'}</h3>
              <button className="mc-modal-close" onClick={closeModal}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mc-modal-form">
              {formError && <div className="mc-modal-error">{formError}</div>}

              <div className="mc-form-group">
                <label className="mc-form-label">Full Name *</label>
                <input
                  className="mc-form-input" type="text" placeholder="Anjali Gupta"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required autoFocus
                />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Relation *</label>
                <input
                  className="mc-form-input" type="text" placeholder="Sister, Friend, Colleague…"
                  value={form.relation}
                  onChange={e => setForm(f => ({ ...f, relation: e.target.value }))}
                  required
                />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Phone Number</label>
                <input
                  className="mc-form-input" type="tel" placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="mc-form-group">
                <label className="mc-form-label">Email</label>
                <input
                  className="mc-form-input" type="email" placeholder="contact@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="mc-modal-actions">
                <button type="button" className="mc-modal-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="mc-modal-submit" disabled={saving}>
                  {saving ? 'Saving…' : (editId ? 'Save Changes' : 'Add to Circle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
