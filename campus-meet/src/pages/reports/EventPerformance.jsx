
import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import "./styles/EventPerformance.css";

const eventImages = {
  "Programming Workshop": "/images/events/programming-workshop.jpg",
  "Volleyball Social": "/images/events/volleyball-social.jpg",
  "Film Screening Night": "/images/events/film-screening.jpg",
};

function EventPerformance() {
  const [events, setEvents] = useState([]);
  const [availableClubs, setAvailableClubs] = useState([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("All");
  const [clubId, setClubId] = useState("All");
  const [search, setSearch] = useState("");

  const [sortField, setSortField] = useState("StartDateTime");
  const [sortDirection, setSortDirection] = useState("desc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load events from the backend
  const loadReport = async (filters = {}) => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await api.get("/api/reports/event-performance", {
        params: {
          start_date: filters.startDate || undefined,
          end_date: filters.endDate || undefined,
          status:
            filters.status && filters.status !== "All"
              ? filters.status
              : undefined,
          club_id:
            filters.clubId && filters.clubId !== "All"
              ? filters.clubId
              : undefined,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const reportData = response.data.data || [];

      setEvents(reportData);

      // Step 4: Keep the club dropdown populated after filtering
      if (filters.clubId === undefined || filters.clubId === "All") {
        setAvailableClubs((previous) => {
          if (previous.length > 0) return previous;

          const uniqueClubs = new Map();

          reportData.forEach((event) => {
            if (event.ClubID && event.ClubName) {
              uniqueClubs.set(event.ClubID, event.ClubName);
            }
          });

          return Array.from(uniqueClubs, ([id, name]) => ({
            id,
            name,
          }));
        });
      }
    } catch (err) {
      console.error("Event performance report error:", err);

      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to load the event performance report."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // Full club list from the initial unfiltered report
  const clubs = availableClubs;

  // Search and sort events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (search.trim()) {
      const searchTerm = search.toLowerCase();

      result = result.filter(
        (event) =>
          event.EventName?.toLowerCase().includes(searchTerm) ||
          event.ClubName?.toLowerCase().includes(searchTerm) ||
          event.Location?.toLowerCase().includes(searchTerm)
      );
    }

    result.sort((a, b) => {
      let first = a[sortField];
      let second = b[sortField];

      if (sortField === "StartDateTime") {
        first = new Date(first).getTime();
        second = new Date(second).getTime();
      } else if (typeof first === "string") {
        first = first.toLowerCase();
        second = second?.toLowerCase();
      }

      if (first < second) return sortDirection === "asc" ? -1 : 1;
      if (first > second) return sortDirection === "asc" ? 1 : -1;

      return 0;
    });

    return result;
  }, [events, search, sortField, sortDirection]);

  // Statistics based on the events returned by the current filters
  const totalEvents = events.length;

  const approvedEvents = events.filter(
    (event) => event.Status === "Approved"
  ).length;

  const pendingEvents = events.filter(
    (event) => event.Status === "Pending"
  ).length;

  const completedEvents = events.filter(
    (event) => event.Status === "Completed"
  ).length;

  const cancelledEvents = events.filter(
    (event) => event.Status === "Cancelled"
  ).length;

  const totalCapacity = events.reduce(
    (total, event) => total + Number(event.Capacity || 0),
    0
  );

  const totalBudget = events.reduce(
    (total, event) => total + Number(event.Budget || 0),
    0
  );

  // Apply filters
  const handleApplyFilters = () => {
    if (startDate && endDate && startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    loadReport({
      startDate,
      endDate,
      status,
      clubId,
    });
  };

  // Clear filters
  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStatus("All");
    setClubId("All");
    setSearch("");
    setError("");

    loadReport();
  };

  // Sort table columns
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((previous) =>
        previous === "asc" ? "desc" : "asc"
      );
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortIcon = (field) => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  // Format date
  const formatDate = (value) => {
    if (!value) return "N/A";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format currency
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  // Approve or cancel an event
  const handleStatusChange = async (eventId, newStatus) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${newStatus.toLowerCase()} this event?`
    );

    if (!confirmed) return;

    try {
      setError("");

      const token = localStorage.getItem("access_token");

      await api.patch(
        `/api/reports/events/${eventId}/status`,
        null,
        {
          params: {
            new_status: newStatus,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Reload using the current filters
      await loadReport({
        startDate,
        endDate,
        status,
        clubId,
      });
    } catch (err) {
      console.error("Event status update error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to update event status."
      );
    }
  };

  // Export currently displayed events to CSV
  const exportCSV = () => {
    const headers = [
      "Event ID",
      "Event Name",
      "Club",
      "Date",
      "Location",
      "Capacity",
      "Budget",
      "Status",
    ];

    const rows = filteredEvents.map((event) => [
      event.EventID,
      event.EventName,
      event.ClubName,
      event.StartDateTime,
      event.Location,
      event.Capacity,
      event.Budget,
      event.Status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", "event-performance-report.csv");

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="event-report-page">
      <div className="event-report-container">

        {/* Header */}
        <div className="event-report-header">
          <div>
            <button
              className="event-back-button"
              onClick={() => (window.location.href = "/admin")}
            >
              ← Back to Dashboard
            </button>

            <h1>Event Performance Report</h1>

            <p>
              Review event activity, status, capacity and budget across clubs.
            </p>
          </div>

          <div className="event-header-actions">
            <button className="event-export-button" onClick={exportCSV}>
              Export CSV
            </button>

            <button
              className="event-print-button"
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {error && <div className="event-error">{error}</div>}

        {/* Statistics */}
        <div className="event-stats-grid">
          <div className="event-stat-card">
            <span>Total Events</span>
            <strong>{totalEvents}</strong>
          </div>

          <div className="event-stat-card">
            <span>Approved</span>
            <strong>{approvedEvents}</strong>
          </div>

          <div className="event-stat-card">
            <span>Pending</span>
            <strong>{pendingEvents}</strong>
          </div>

          <div className="event-stat-card">
            <span>Completed</span>
            <strong>{completedEvents}</strong>
          </div>

          <div className="event-stat-card">
            <span>Cancelled</span>
            <strong>{cancelledEvents}</strong>
          </div>

          <div className="event-stat-card">
            <span>Total Capacity</span>
            <strong>{totalCapacity.toLocaleString("en-AU")}</strong>
          </div>

          <div className="event-stat-card">
            <span>Total Budget</span>
            <strong>{formatCurrency(totalBudget)}</strong>
          </div>
        </div>

        {/* Filters */}
        <div className="event-filter-section">
          <h2>Filter Events</h2>

          <div className="event-filter-grid">
            <div className="event-filter-field">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="event-filter-field">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="event-filter-field">
              <label>Event Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="event-filter-field">
              <label>Club</label>
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
              >
                <option value="All">All Clubs</option>

                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="event-filter-actions">
            <button
              className="event-apply-button"
              onClick={handleApplyFilters}
              disabled={loading}
            >
              Apply Filters
            </button>

            <button
              className="event-clear-button"
              onClick={handleClearFilters}
              disabled={loading}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Event Records */}
        <div className="event-table-section">
          <div className="event-table-header">
            <div>
              <h2>Event Records</h2>
              <p>{filteredEvents.length} events found</p>
            </div>

            <input
              className="event-search-input"
              type="text"
              placeholder="Search events, clubs or locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="event-loading">
              Loading event report...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="event-empty">
              No events found matching your filters.
            </div>
          ) : (
            <div className="event-table-wrapper">
              <table className="event-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort("EventID")}>
                      Event ID{sortIcon("EventID")}
                    </th>

                    <th>Event</th>

                    <th onClick={() => handleSort("ClubName")}>
                      Club{sortIcon("ClubName")}
                    </th>

                    <th onClick={() => handleSort("StartDateTime")}>
                      Date{sortIcon("StartDateTime")}
                    </th>

                    <th>Location</th>

                    <th onClick={() => handleSort("Capacity")}>
                      Capacity{sortIcon("Capacity")}
                    </th>

                    <th onClick={() => handleSort("Budget")}>
                      Budget{sortIcon("Budget")}
                    </th>

                    <th onClick={() => handleSort("Status")}>
                      Status{sortIcon("Status")}
                    </th>

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.EventID}>
                      <td>{event.EventID}</td>

                      <td>
                        <div className="event-name-cell">
                          {eventImages[event.EventName] && (
                            <img
                              src={eventImages[event.EventName]}
                              alt={event.EventName}
                              className="event-thumbnail"
                            />
                          )}

                          <span>{event.EventName}</span>
                        </div>
                      </td>

                      <td>{event.ClubName || "N/A"}</td>

                      <td>{formatDate(event.StartDateTime)}</td>

                      <td>{event.Location || "N/A"}</td>

                      <td>{event.Capacity ?? "N/A"}</td>

                      <td>{formatCurrency(event.Budget)}</td>

                      <td>
                        <span
                          className={`event-status status-${event.Status?.toLowerCase()}`}
                        >
                          {event.Status}
                        </span>
                      </td>

                      {/* Approve / Cancel actions */}
                      <td>
                        {event.Status === "Pending" && (
                          <div className="event-action-buttons">
                            <button
                              className="event-approve-button"
                              onClick={() =>
                                handleStatusChange(
                                  event.EventID,
                                  "Approved"
                                )
                              }
                            >
                              Approve
                            </button>

                            <button
                              className="event-cancel-button"
                              onClick={() =>
                                handleStatusChange(
                                  event.EventID,
                                  "Cancelled"
                                )
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {event.Status === "Approved" && (
                          <button
                            className="event-cancel-button"
                            onClick={() =>
                              handleStatusChange(
                                event.EventID,
                                "Cancelled"
                              )
                            }
                          >
                            Cancel
                          </button>
                        )}

                        {(event.Status === "Completed" ||
                          event.Status === "Cancelled") && (
                          <span className="event-no-action">
                            No action
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EventPerformance;
