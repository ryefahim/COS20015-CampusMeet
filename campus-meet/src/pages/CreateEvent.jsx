import { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/CreateEvent.css";

function CreateEvent() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    club_id: "",
    event_name: "",
    start_datetime: "",
    end_datetime: "",
    location: "",
    capacity: "",
    budget: "",
  });

  useEffect(() => {
    const loadPage = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        window.location.href = "/";
        return;
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      try {
        // Verify administrator access
        const userResponse = await api.get(
          "/api/auth/me",
          config
        );

        const user = userResponse.data.user;
        const role = String(user?.Role ?? user?.role ?? "")
          .trim()
          .toLowerCase();

        if (role !== "admin") {
          window.location.href = "/dashboard";
          return;
        }

        // Retrieve available clubs
        const clubsResponse = await api.get(
          "/api/admin/events/clubs",
          config
        );

        setClubs(clubsResponse.data);
      } catch (err) {
        console.error("Create event page error:", err);

        if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          window.location.href = "/";
          return;
        }

        setError("Could not load the event creation page.");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const token = localStorage.getItem("access_token");

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const payload = {
      club_id: Number(formData.club_id),
      event_name: formData.event_name.trim(),
      start_datetime: formData.start_datetime,
      end_datetime: formData.end_datetime,
      location: formData.location.trim() || null,
      capacity: formData.capacity
        ? Number(formData.capacity)
        : null,
      budget: formData.budget
        ? Number(formData.budget)
        : null,
    };

    if (
      new Date(payload.end_datetime) <=
      new Date(payload.start_datetime)
    ) {
      setError("The end date and time must be after the start date and time.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.post(
        "/api/admin/events",
        payload,
        config
      );

      setSuccess(
        `Event successfully created! Event ID: ${response.data.event_id}. Status: Pending.`
      );

      setFormData({
        club_id: "",
        event_name: "",
        start_datetime: "",
        end_datetime: "",
        location: "",
        capacity: "",
        budget: "",
      });

    } catch (err) {
      console.error("Create event error:", err);

      setError(
        err.response?.data?.detail ||
        "Could not create the event. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="create-event-loading">Loading...</div>;
  }

  return (
    <div className="create-event-page">

      <header className="create-event-header">
        <div>
          <h1>CampusMeet Admin</h1>
          <p>Create a new club event</p>
        </div>

        <button
          className="back-button"
          onClick={() => {
            window.location.href = "/admin";
          }}
        >
          Back to Dashboard
        </button>
      </header>

      <main className="create-event-content">

        <section className="create-event-heading">
          <h2>Create New Event</h2>
          <p>
            Enter the event details below to create a new
            event for a club.
          </p>
        </section>

        {error && (
          <div className="create-event-error">
            {error}
          </div>
        )}

        {success && (
          <div className="create-event-success">
            {success}
          </div>
        )}

        <form
          className="create-event-form"
          onSubmit={handleSubmit}
        >

          <div className="form-group">
            <label htmlFor="club_id">Select Club *</label>

            <select
              id="club_id"
              name="club_id"
              value={formData.club_id}
              onChange={handleChange}
              required
            >
              <option value="">Choose a club</option>

              {clubs.map((club) => (
                <option
                  key={club.ClubID}
                  value={club.ClubID}
                >
                  {club.ClubName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="event_name">Event Name *</label>

            <input
              type="text"
              id="event_name"
              name="event_name"
              value={formData.event_name}
              onChange={handleChange}
              placeholder="Enter event name"
              maxLength="100"
              required
            />
          </div>

          <div className="form-row">

            <div className="form-group">
              <label htmlFor="start_datetime">
                Start Date and Time *
              </label>

              <input
                type="datetime-local"
                id="start_datetime"
                name="start_datetime"
                value={formData.start_datetime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="end_datetime">
                End Date and Time *
              </label>

              <input
                type="datetime-local"
                id="end_datetime"
                name="end_datetime"
                value={formData.end_datetime}
                onChange={handleChange}
                required
              />
            </div>

          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>

            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Enter event location"
              maxLength="150"
            />
          </div>

          <div className="form-row">

            <div className="form-group">
              <label htmlFor="capacity">
                Event Capacity
              </label>

              <input
                type="number"
                id="capacity"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="Maximum attendees"
                min="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="budget">Budget ($)</label>

              <input
                type="number"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="Enter event budget"
                min="0"
                step="0.01"
              />
            </div>

          </div>

          <div className="event-status-info">
            <strong>Event Status:</strong> Pending approval
            <p>
              All newly created events are automatically
              submitted with Pending status.
            </p>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                window.location.href = "/admin";
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="submit-event-button"
              disabled={submitting}
            >
              {submitting ? "Creating Event..." : "Create Event"}
            </button>
          </div>

        </form>

      </main>
    </div>
  );
}

export default CreateEvent;
