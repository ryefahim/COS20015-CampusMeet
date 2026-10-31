
import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import "./styles/ClubEngagement.css";

const clubImages = {
  "Programming Club": "/images/clubs/programming-club.jpg",
  "Debate Club": "/images/clubs/debate-club.jpg",
  "Photography Club": "/images/clubs/photography-club.jpg",
};

function ClubEngagement() {
  const [report, setReport] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("ActiveMembers");
  const [sortDirection, setSortDirection] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("access_token");

      if (!token) {
        window.location.href = "/";
        return;
      }

      const response = await api.get(
        "/api/reports/club-engagement",
        {
          params: {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setReport(response.data.data || []);
    } catch (err) {
      console.error("Club engagement report error:", err);

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        window.location.href = "/";
        return;
      }

      setError(
        err.response?.data?.detail ||
        "Unable to load the club engagement report."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const categories = [
    "All",
    ...new Set(report.map((club) => club.Category).filter(Boolean)),
  ];

  const filteredReport = useMemo(() => {
    return report
      .filter((club) => {
        const matchesCategory =
          category === "All" || club.Category === category;

        const matchesSearch =
          club.ClubName.toLowerCase().includes(search.toLowerCase());

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const first = a[sortField] ?? 0;
        const second = b[sortField] ?? 0;

        const comparison =
          typeof first === "string"
            ? first.localeCompare(second)
            : first - second;

        return sortDirection === "asc"
          ? comparison
          : -comparison;
      });
  }, [report, category, search, sortField, sortDirection]);

  const totalClubs = report.length;

  const totalActiveMembers = report.reduce(
    (total, club) => total + Number(club.ActiveMembers || 0),
    0
  );

  const totalInactiveMembers = report.reduce(
    (total, club) => total + Number(club.InactiveMembers || 0),
    0
  );

  const totalMemberships = report.reduce(
    (total, club) =>
      total + Number(club.TotalMembershipRecords || 0),
    0
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(
        sortDirection === "asc" ? "desc" : "asc"
      );
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportCSV = () => {
    const headers = [
      "Club ID",
      "Club Name",
      "Category",
      "Active Members",
      "Inactive Members",
      "Total Membership Records",
    ];

    const rows = filteredReport.map((club) => [
      club.ClubID,
      club.ClubName,
      club.Category || "",
      club.ActiveMembers,
      club.InactiveMembers,
      club.TotalMembershipRecords,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "club-engagement-report.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="club-report-page">
      <header className="club-report-header">
        <div>
          <button
            className="club-back-button"
            onClick={() => {
              window.location.href = "/admin";
            }}
          >
            Back to Dashboard
          </button>

          <h1>Club Engagement Report</h1>
          <p>
            Analyse club memberships and student participation
            across CampusMeet.
          </p>
        </div>

        <div className="club-report-actions">
          <button onClick={exportCSV}>
            Export CSV
          </button>

          <button onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="club-report-error">
          {error}
        </div>
      )}

      <section className="club-report-statistics">
        <div className="club-report-stat">
          <span>Total Clubs</span>
          <h2>{totalClubs}</h2>
        </div>

        <div className="club-report-stat">
          <span>Active Members</span>
          <h2>{totalActiveMembers}</h2>
        </div>

        <div className="club-report-stat">
          <span>Inactive Members</span>
          <h2>{totalInactiveMembers}</h2>
        </div>

        <div className="club-report-stat">
          <span>Total Membership Records</span>
          <h2>{totalMemberships}</h2>
        </div>
      </section>

      <section className="club-report-filters">
        <div>
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button
          onClick={loadReport}
          disabled={loading}
        >
          Apply Dates
        </button>

        <button
          className="club-clear-button"
          onClick={() => {
            setStartDate("");
            setEndDate("");
            setCategory("All");
            setSearch("");
            setTimeout(loadReport, 0);
          }}
        >
          Clear Filters
        </button>
      </section>

      <section className="club-report-table-section">
        <div className="club-report-table-heading">
          <div>
            <h2>Club Membership Overview</h2>
            <p>
              View and compare membership activity across clubs.
            </p>
          </div>
        </div>

        <div className="club-report-table-filters">
          <input
            type="text"
            placeholder="Search clubs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "All" ? "All Categories" : item}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="club-report-message">
            Loading club engagement report...
          </p>
        ) : (
          <div className="club-report-table-wrapper">
            <table className="club-report-table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th onClick={() => handleSort("Category")}>
                    Category ↕
                  </th>
                  <th onClick={() => handleSort("ActiveMembers")}>
                    Active Members ↕
                  </th>
                  <th onClick={() => handleSort("InactiveMembers")}>
                    Inactive Members ↕
                  </th>
                  <th onClick={() => handleSort("TotalMembershipRecords")}>
                    Total Memberships ↕
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredReport.map((club) => (
                  <tr key={club.ClubID}>
                    <td>
                      <div className="club-report-name">
                        {clubImages[club.ClubName] && (
                          <img
                            src={clubImages[club.ClubName]}
                            alt={club.ClubName}
                            className="club-report-image"
                          />
                        )}

                        <div>
                          <strong>{club.ClubName}</strong>
                          <small>{club.Description || "No description available"}</small>
                        </div>
                      </div>
                    </td>

                    <td>{club.Category || "Uncategorised"}</td>

                    <td>
                      <span className="club-active-count">
                        {club.ActiveMembers}
                      </span>
                    </td>

                    <td>{club.InactiveMembers}</td>

                    <td>{club.TotalMembershipRecords}</td>
                  </tr>
                ))}

                {filteredReport.length === 0 && (
                  <tr>
                    <td colSpan="5" className="club-report-empty">
                      No clubs match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="club-report-result-count">
          Showing {filteredReport.length} of {totalClubs} clubs
        </p>
      </section>
    </div>
  );
}

export default ClubEngagement;
