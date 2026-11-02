
import { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/AdminDashboard.css";

function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [summary, setSummary] = useState(null);
  const [generatedReports, setGeneratedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    const loadAdminDashboard = async () => {
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
        const userResponse = await api.get("/api/auth/me", config);
        const user = userResponse.data.user;

        if (!user) {
          throw new Error("User information was not returned.");
        }

        const role = String(user.Role ?? user.role ?? "")
          .trim()
          .toLowerCase();

        if (role !== "admin") {
          window.location.href = "/dashboard";
          return;
        }

        setAdmin(user);

        const summaryResponse = await api.get(
          "/api/dashboard/admin-summary",
          config
        );

        setSummary(summaryResponse.data);

        // Load generated report history
        await loadGeneratedReports(config);

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

  // Retrieve generated reports
  const loadGeneratedReports = async (config) => {
    setReportsLoading(true);
    setReportError("");

    try {
      const response = await api.get(
        "/api/reports/generated",
        config
      );

      const reports = Array.isArray(response.data)
        ? response.data
        : response.data.reports ??
          response.data.generated_reports ??
          [];

      setGeneratedReports(reports);

    } catch (err) {
      console.error("Generated reports error:", err);
      setReportError("Could not load generated reports.");
    } finally {
      setReportsLoading(false);
    }
  };

  // Download a generated report
  const handleDownload = async (report) => {
    const reportId = report.ReportRunID;

    try {
      setDownloading(reportId);

      const response = await api.get(
        `/api/reports/generated/${reportId}/download`,
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = report.FileName;
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      console.error("Report download error:", err);
      alert("Could not download this report. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  // Log out
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="admin-loading">
        Loading admin dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        {error}
      </div>
    );
  }

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

        {/* Create Event Section */}
        <section className="admin-create-event">
          <div>
            <h2>Event Management</h2>
            <p>
              Create new events for clubs. Newly created events
              will be submitted with Pending status for approval.
            </p>
          </div>

          <button
            onClick={() => {
              window.location.href = "/admin/create-event";
            }}
          >
            Create New Event
          </button>
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

        {/* Generated Reports Section */}
        <section className="admin-generated-reports">

          <div className="generated-reports-header">
            <div>
              <h2>Generated Reports</h2>
              <p>
                View and download automatically generated database reports.
              </p>
            </div>

            <button
              onClick={() =>
                loadGeneratedReports({
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                  },
                })
              }
              disabled={reportsLoading}
            >
              {reportsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {reportError && (
            <p className="generated-reports-error">
              {reportError}
            </p>
          )}

          {reportsLoading ? (
            <p>Loading generated reports...</p>
          ) : generatedReports.length === 0 ? (
            <p className="no-generated-reports">
              No generated reports available yet.
            </p>
          ) : (
            <div className="generated-reports-table-wrapper">
              <table className="generated-reports-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Format</th>
                    <th>Generated At</th>
                    <th>Records</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {generatedReports.map((report) => (
                    <tr key={report.ReportRunID}>
                      <td>{report.ReportName}</td>

                      <td>
                        {report.FileName?.split(".").pop()?.toUpperCase()}
                      </td>

                      <td>
                        {report.GeneratedAt
                          ? new Date(report.GeneratedAt).toLocaleString()
                          : "N/A"}
                      </td>

                      <td>{report.RecordCount ?? 0}</td>

                      <td>
                        <span
                          className={`generated-status ${
                            report.Status?.toLowerCase()
                          }`}
                        >
                          {report.Status}
                        </span>
                      </td>

                      <td>
                        {report.Status === "Success" ? (
                          <button
                            className="generated-download-button"
                            onClick={() => handleDownload(report)}
                            disabled={
                              downloading === report.ReportRunID
                            }
                          >
                            {downloading === report.ReportRunID
                              ? "Downloading..."
                              : "Download"}
                          </button>
                        ) : (
                          "Unavailable"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </section>

      </main>
    </div>
  );
}

export default AdminDashboard;
