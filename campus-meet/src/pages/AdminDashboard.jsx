import { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/AdminDashboard.css";

function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAdminDashboard = async () => {
      const token = localStorage.getItem("access_token");

      // Check whether a token exists
      if (!token) {
        window.location.href = "/";
        return;
      }

      // Attach the JWT to authenticated requests
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      try {
        // Verify the logged-in user
        const userResponse = await api.get(
          "/api/auth/me",
          config
        );

        // The backend returns { user: current_user }
        const user = userResponse.data.user;

        if (!user) {
          throw new Error("User information was not returned.");
        }

        // Normalise role
        const role = String(user.Role ?? user.role ?? "")
          .trim()
          .toLowerCase();

        // Only administrators can access this page
        if (role !== "admin") {
          window.location.href = "/dashboard";
          return;
        }

        setAdmin(user);

        // Retrieve administrator overview statistics
        const summaryResponse = await api.get(
          "/api/dashboard/admin-summary",
          config
        );

        setSummary(summaryResponse.data);

      } catch (err) {
        console.error("Admin dashboard error:", err);

        if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");

          window.location.href = "/";
          return;
        }

        setError("Could not load the admin dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadAdminDashboard();
  }, []);

  // Log out
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    window.location.href = "/";
  };

  // Loading state
  if (loading) {
    return (
      <div className="admin-loading">
        Loading admin dashboard...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="admin-error">
        {error}
      </div>
    );
  }

  // Available reports
  const reports = [
    {
      title: "Club Engagement",
      description:
        "Explore club memberships and student participation.",
      id: "club-engagement",
    },
    {
      title: "Event Performance",
      description:
        "Review event information and student participation.",
      id: "event-performance",
    },
    {
      title: "Resource Management",
      description:
        "Monitor resource bookings and usage.",
      id: "resource-management",
    },
  ];

  return (
    <div className="admin-dashboard">

      {/* Header */}
      <header className="admin-header">
        <div>
          <h1>CampusMeet Admin</h1>
          <p>Administration Dashboard</p>
        </div>

        <div className="admin-header-right">
          <span>
            Welcome,{" "}
            {admin?.FirstName ?? admin?.first_name ?? "Admin"}
          </span>

          <button onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="admin-content">

        {/* Welcome Section */}
        <section className="admin-welcome">
          <h2>Dashboard Overview</h2>

          <p>
            Manage CampusMeet information and view database reports.
          </p>
        </section>

        {/* Database Statistics */}
        <section className="admin-statistics">
          <h2>Database Summary</h2>

          <div className="admin-stat-grid">

            <div className="admin-stat-card">
              <h3>Total Students</h3>
              <p>{summary?.students ?? 0}</p>
            </div>

            <div className="admin-stat-card">
              <h3>Total Clubs</h3>
              <p>{summary?.clubs ?? 0}</p>
            </div>

            <div className="admin-stat-card">
              <h3>Total Memberships</h3>
              <p>{summary?.memberships ?? 0}</p>
            </div>

            <div className="admin-stat-card">
              <h3>Total Events</h3>
              <p>{summary?.events ?? 0}</p>
            </div>

            <div className="admin-stat-card">
              <h3>Pending Events</h3>
              <p>{summary?.pending_events ?? 0}</p>
            </div>

          </div>
        </section>

        {/* Reports Section */}
        <section className="admin-reports">
          <h2>Database Reports</h2>

          <p>
            Select a report to explore more detailed database information.
          </p>

          <div className="admin-report-grid">

            {reports.map((report) => (
              <div
                className="admin-report-card"
                key={report.id}
              >
                <h3>{report.title}</h3>

                <p>{report.description}</p>

                <button
                  onClick={() => {
                    window.location.href =
                      `/admin/reports/${report.id}`;
                  }}
                >
                  View Report
                </button>
              </div>
            ))}

          </div>
        </section>

      </main>
    </div>
  );
}

export default AdminDashboard;
