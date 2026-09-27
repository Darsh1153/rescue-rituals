import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type EventSummary } from '../api';
import { useAuth } from '../auth';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.listEvents();
        if (!cancelled) setEvents(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load events');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <div className="row between">
        <div>
          <h1>Events</h1>
          <p className="muted">Browse upcoming events and RSVP.</p>
        </div>
        {user && (
          <Link className="button" to="/events/new">
            Create event
          </Link>
        )}
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      <div className="event-list">
        {events.map((event) => (
          <Link key={event.id} to={`/events/${event.id}`} className="event-row">
            <div>
              <h2>{event.title}</h2>
              <p className="muted">
                {formatDate(event.startsAt)} · {event.location}
              </p>
            </div>
            <div className="meta">
              <span>
                {event.attendeeCount}/{event.capacity} attending
              </span>
              <span className="muted">by {event.owner.name}</span>
            </div>
          </Link>
        ))}
        {!loading && !events.length && (
          <p className="muted">No events yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}
