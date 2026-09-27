import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type EventDetail } from '../api';
import { useAuth } from '../auth';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await api.getEvent(id);
    setEvent(data);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load event');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const isOwner = !!(user && event && user.id === event.ownerId);
  const hasRsvped = !!(
    user &&
    event &&
    event.attendees.some((a) => a.id === user.id)
  );

  async function toggleRsvp() {
    if (!id || !user) {
      navigate('/login');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (hasRsvped) {
        await api.cancelRsvp(id);
      } else {
        await api.rsvp(id);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RSVP failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!id || !confirm('Delete this event?')) return;
    setBusy(true);
    try {
      await api.deleteEvent(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  if (!event && !error) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <Link to="/">Back to events</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <p>
        <Link to="/">← All events</Link>
      </p>
      <div className="row between">
        <div>
          <h1>{event.title}</h1>
          <p className="muted">
            {formatDate(event.startsAt)} · {event.location}
          </p>
        </div>
        <div className="actions">
          {isOwner && (
            <>
              <Link className="button secondary" to={`/events/${event.id}/edit`}>
                Edit
              </Link>
              <button
                className="danger"
                type="button"
                onClick={onDelete}
                disabled={busy}
              >
                Delete
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleRsvp}
            disabled={busy || (!hasRsvped && event.spotsLeft === 0)}
          >
            {!user
              ? 'Sign in to RSVP'
              : hasRsvped
                ? 'Cancel RSVP'
                : event.spotsLeft === 0
                  ? 'Full'
                  : 'RSVP'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <p className="body">{event.description}</p>

      <div className="stats">
        <span>
          {event.attendeeCount}/{event.capacity} attending
        </span>
        <span>{event.spotsLeft} spots left</span>
        <span>Hosted by {event.owner.name}</span>
      </div>

      <h2>Attendees</h2>
      {event.attendees.length === 0 ? (
        <p className="muted">No one has RSVPed yet.</p>
      ) : (
        <ul className="attendees">
          {event.attendees.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong>
              <span className="muted">{a.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
