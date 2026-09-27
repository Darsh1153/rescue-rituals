import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type FormState = {
  title: string;
  description: string;
  startsAt: string;
  location: string;
  capacity: number;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    startsAt: toLocalInputValue(new Date(Date.now() + 86400000).toISOString()),
    location: '',
    capacity: 50,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const event = await api.getEvent(id);
        if (cancelled) return;
        setForm({
          title: event.title,
          description: event.description,
          startsAt: toLocalInputValue(event.startsAt),
          location: event.location,
          capacity: event.capacity,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load event');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, id]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const startsAtDate = new Date(form.startsAt);
    if (Number.isNaN(startsAtDate.getTime())) {
      setError('Please enter a valid start date and time');
      setSaving(false);
      return;
    }

    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError('Capacity must be a whole number of at least 1');
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      startsAt: startsAtDate.toISOString(),
      capacity,
    };

    try {
      if (mode === 'create') {
        const created = await api.createEvent(payload);
        navigate(`/events/${created.id}`);
      } else if (id) {
        const updated = await api.updateEvent(id, payload);
        navigate(`/events/${updated.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <p>
        <Link to={mode === 'edit' && id ? `/events/${id}` : '/'}>← Back</Link>
      </p>
      <h1>{mode === 'create' ? 'Create event' : 'Edit event'}</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Title
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
        </label>
        <label>
          Starts at
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            required
          />
        </label>
        <label>
          Location
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            required
          />
        </label>
        <label>
          Capacity
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) =>
              setForm({ ...form, capacity: Number(e.target.value) })
            }
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
