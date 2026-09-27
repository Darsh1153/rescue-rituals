// Leave empty in local dev so requests go to the Vite server and are proxied to Nest.
// For a remote API, set e.g. VITE_API_URL=https://your-api.example.com

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type User = {
  id: string;
  email: string;
  name: string;
};

export type EventSummary = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  location: string;
  capacity: number;
  ownerId: string;
  owner: User;
  attendeeCount: number;
  spotsLeft: number;
  createdAt: string;
  updatedAt: string;
};

export type EventDetail = EventSummary & {
  attendees: Array<User & { rsvpedAt: string }>;
};

type AuthResponse = {
  access_token: string;
  user: User;
};

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot reach the API. Is the backend running on http://localhost:3000?",
    );
  }

  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Invalid JSON from API"
          : `Request failed (${res.status} ${res.statusText})`,
      );
    }
  }

  if (!res.ok) {
    const body = data as { message?: string | string[] } | null;

    let message: string;

    if (Array.isArray(body?.message)) {
      message = body.message.join(", ");
    } else if (typeof body?.message === "string") {
      message = body.message;
    } else {
      message = res.statusText || "Request failed";
    }

    throw new Error(message);
  }

  return data as T;
}

export const api = {
  register: (body: { email: string; password: string; name: string }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listEvents: (page = 1, limit = 20) =>
    request<{
      data: EventSummary[];
      meta: { total: number; page: number; limit: number };
    }>(`/events?page=${page}&limit=${limit}`),

  getEvent: (id: string) => request<EventDetail>(`/events/${id}`),

  createEvent: (body: {
    title: string;
    description: string;
    startsAt: string;
    location: string;
    capacity: number;
  }) =>
    request<EventSummary>("/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateEvent: (
    id: string,
    body: Partial<{
      title: string;
      description: string;
      startsAt: string;
      location: string;
      capacity: number;
    }>,
  ) =>
    request<EventSummary>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteEvent: (id: string) =>
    request<{ message: string }>(`/events/${id}`, {
      method: "DELETE",
    }),

  rsvp: (id: string) =>
    request(`/events/${id}/rsvp`, {
      method: "POST",
    }),

  cancelRsvp: (id: string) =>
    request(`/events/${id}/rsvp`, {
      method: "DELETE",
    }),
};