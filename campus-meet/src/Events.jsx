
import { useEffect, useState } from "react";
import api from "./api/axios";
import "./styles/Events.css";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionEventId, setActionEventId] = useState(null);
  const [notice, setNotice] = useState("");

  const token = localStorage.getItem("access_token");

  async function loadEvents() {
    if (!token) {
      setNotice("Please log in to view events.");
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEvents(response.data);
    } catch (error) {
      setNotice(
        error.response?.data?.detail || "Could not load events."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function handleRSVP(event) {
    setActionEventId(event.EventID);
    setNotice("");

    try {
      await api.post(
        `/api/events/${event.EventID}/rsvp`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotice("Your RSVP was successful.");
      await loadEvents();
    } catch (error) {
      setNotice(
        error.response?.data?.detail || "Could not RSVP to this event."
      );
    } finally {
      setActionEventId(null);
    }
  }

  async function handleCancelRSVP(event) {
    setActionEventId(event.EventID);
    setNotice("");

    try {
      await api.delete(`/api/events/${event.EventID}/rsvp`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotice("Your RSVP has been cancelled.");
      await loadEvents();
    } catch (error) {
      setNotice(
        error.response?.data?.detail || "Could not cancel your RSVP."
      );
    } finally {
      setActionEventId(null);
    }
  }

  if (loading) {
    return <main className="events-page">Loading events...</main>;
  }

  return (
    <main className="events-page">
      <div className="events-header">
        <div>
          <h1 className="events-title">Club Events</h1>
          <p className="events-subtitle">
            Discover upcoming events from your clubs.
          </p>
        </div>

        <button
          className="events-back-button"
          onClick={() => (window.location.href = "/dashboard")}
        >
          Back to Dashboard
        </button>
      </div>

      {notice && <div className="events-notice">{notice}</div>}

      {events.length === 0 ? (
        <div className="events-empty">
          <h3>No upcoming events</h3>
          <p>
            Your clubs don't have any approved upcoming events right now.
            Join a club or check again later.
          </p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((event) => {
            const full =
              event.Capacity !== null &&
              event.AttendeeCount >= event.Capacity;

            return (
              <article key={event.EventID} className="event-card">
                <span className="event-club">{event.ClubName}</span>
                <h2 className="event-title">{event.EventName}</h2>

                <p className="event-detail">
                  <strong>Date:</strong>{" "}
                  {new Date(event.StartDateTime).toLocaleDateString(
                    "en-AU",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </p>

                <p className="event-detail">
                  <strong>Time:</strong>{" "}
                  {new Date(event.StartDateTime).toLocaleTimeString(
                    "en-AU",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </p>

                <p className="event-detail">
                  <strong>Location:</strong>{" "}
                  {event.Location || "To be announced"}
                </p>

                <p className="event-attendees">
                  <strong>Attendees:</strong> {event.AttendeeCount}
                  {event.Capacity !== null && ` / ${event.Capacity}`}
                </p>

                {event.HasRSVPd ? (
                  <button
                    className="event-cancel-button"
                    disabled={actionEventId === event.EventID}
                    onClick={() => handleCancelRSVP(event)}
                  >
                    {actionEventId === event.EventID
                      ? "Updating..."
                      : "Cancel RSVP"}
                  </button>
                ) : (
                  <button
                    className="event-rsvp-button"
                    disabled={full || actionEventId === event.EventID}
                    onClick={() => handleRSVP(event)}
                  >
                    {actionEventId === event.EventID
                      ? "Updating..."
                      : full
                        ? "Event Full"
                        : "RSVP"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
