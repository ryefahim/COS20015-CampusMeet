
import { useEffect, useState } from "react";

import api from "../api/axios";

import "../styles/Dashboard.css";

import "../styles/cards.css";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [actionClubId, setActionClubId] = useState(null);

  // Load clubs and student information.
  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);

      // Load clubs for both logged-in and logged-out visitors.
      try {
        const clubsResponse = await api.get("/api/clubs");

        const receivedClubs = Array.isArray(clubsResponse.data)
          ? clubsResponse.data
          : [];

        if (!cancelled) {
          const uniqueClubs = Array.from(
            new Map(
              receivedClubs.map((club) => [club.ClubID, club])
            ).values()
          );

          setClubs(uniqueClubs);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice("Clubs could not be loaded. Please try again later.");
        }
      }

      if (cancelled) return;

      const token = localStorage.getItem("access_token");

      // Visitors can browse clubs without logging in.
      if (!token) {
        setLoading(false);
        return;
      }

      // Load logged-in student information and memberships.
      try {
        const [
          userResponse,
          summaryResponse,
          membershipsResponse,
        ] = await Promise.all([
          api.get("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          api.get("/api/dashboard/user-summary", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          api.get("/api/dashboard/my-memberships", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (cancelled) return;

        const data = userResponse.data?.user ?? userResponse.data;

        const currentUser = {
          ...data,

          FirstName:
            data.FirstName ??
            data.first_name ??
            data.firstName ??
            data.firstname ??
            "",

          LastName:
            data.LastName ??
            data.last_name ??
            data.lastName ??
            data.lastname ??
            "",
        };

        setUser(currentUser);
        setSummary(summaryResponse.data);
        setMemberships(membershipsResponse.data);

      } catch (error) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");

        if (!cancelled) {
          setUser(null);
          setSummary(null);
          setMemberships([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  // Log out.
  function logOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  // Refresh student memberships after joining or leaving a club.
  async function refreshMemberships() {
    const token = localStorage.getItem("access_token");

    const [summaryResponse, membershipsResponse] = await Promise.all([
      api.get("/api/dashboard/user-summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),

      api.get("/api/dashboard/my-memberships", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    ]);

    setSummary(summaryResponse.data);
    setMemberships(membershipsResponse.data);
  }

  // Join a club.
  async function handleJoinClub(clubId) {
    const token = localStorage.getItem("access_token");

    if (!token || !user) {
      setNotice("Please log in or register to join a club.");
      return;
    }

    setActionClubId(clubId);
    setNotice("");

    try {
      const response = await api.post(
        `/api/clubs/${clubId}/join`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await refreshMemberships();

      setNotice(response.data.message || "Club membership updated.");
    } catch (error) {
      setNotice(
        error.response?.data?.detail ||
          "Could not join this club. Please try again."
      );
    } finally {
      setActionClubId(null);
    }
  }

  // Leave a club.
  async function handleLeaveClub(clubId) {
    const token = localStorage.getItem("access_token");

    if (!token || !user) {
      setNotice("Please log in to manage your memberships.");
      return;
    }

    setActionClubId(clubId);
    setNotice("");

    try {
      const response = await api.post(
        `/api/clubs/${clubId}/leave`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await refreshMemberships();

      setNotice(response.data.message || "You have left the club.");
    } catch (error) {
      setNotice(
        error.response?.data?.detail ||
          "Could not leave this club. Please try again."
      );
    } finally {
      setActionClubId(null);
    }
  }

  // Available club categories.
  const categories = [
    "All",
    ...new Set(clubs.map((club) => club.Category).filter(Boolean)),
  ];

  // Search and filter clubs.
  const filteredClubs = clubs.filter((club) => {
    const clubName = club.ClubName || "";
    const description = club.Description || "";

    const matchesSearch =
      clubName.toLowerCase().includes(search.toLowerCase()) ||
      description.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      category === "All" || club.Category === category;

    return matchesSearch && matchesCategory;
  });

  // Only show active memberships.
  const activeMemberships = memberships.filter(
    (membership) => membership.MembershipStatus === "Active"
  );

  if (loading) {
    return (
      <div className="dashboard-loading">
        Loading CampusMeet...
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      {/* Header */}
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/dashboard">
          CampusMeet
        </a>

        <div className="header-account">
          <a className="account-button" href="/events">
            Events
          </a>

          {user ? (
            <button className="account-button" onClick={logOut}>
              Log out
            </button>
          ) : (
            <a className="account-button" href="/">
              Log in
            </a>
          )}
        </div>
      </header>

      <main className="dashboard-content">

        {/* Welcome section */}
        <section className="welcome-section">
          <p className="section-eyebrow">
            {user ? "YOUR CAMPUS COMMUNITY" : "WELCOME TO CAMPUSMEET"}
          </p>

          <h1>
            {user
              ? `Welcome back, ${user.FirstName || "there"}`
              : "Welcome!"}
          </h1>

          <p className="welcome-description">
            {user
              ? "Explore clubs and keep track of your memberships."
              : "Browse university clubs and find communities that interest you. Log in to access membership features."}
          </p>

          {!user && (
            <a className="primary-button" href="/">
              Log in to get started
            </a>
          )}
        </section>

        {/* Notifications */}
        {notice && (
          <div className="dashboard-notice" role="status">
            <p>{notice}</p>

            {!user && (
              <a href="/" className="notice-link">
                Log in or register
              </a>
            )}

            <button
              className="notice-dismiss"
              onClick={() => setNotice("")}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Student activity and memberships */}
        {user && summary && (
          <section className="summary-section">
            <h2>Your activity</h2>

            <div className="summary-grid user-summary-grid">
              <div className="summary-card">
                <p>Active memberships</p>
                <strong>
                  {summary.active_memberships ?? 0}
                </strong>
              </div>
            </div>

            <h2 className="subsection-heading">
              My memberships
            </h2>

            {activeMemberships.length === 0 ? (
              <p className="empty-message">
                You have not joined any clubs yet. Browse the clubs below
                to find one that interests you.
              </p>
            ) : (
              <div className="membership-list">
                {activeMemberships.map((membership) => (
                  <div
                    className="membership-row"
                    key={membership.MembershipID}
                  >
                    <div>
                      <h3>{membership.ClubName}</h3>
                      <p>
                        {membership.Category || "University club"}
                      </p>
                    </div>

                    <span className="membership-status">
                      {membership.MembershipStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Explore clubs */}
        <section className="clubs-section">
          <div className="clubs-heading">
            <div>
              <p className="section-eyebrow">
                FIND YOUR COMMUNITY
              </p>

              <h2>Explore clubs</h2>
            </div>

            <span className="club-count">
              {filteredClubs.length} clubs
            </span>
          </div>

          {/* Search and category filters */}
          <div className="club-filters">
            <input
              type="search"
              placeholder="Search clubs..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search clubs"
            />

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter clubs by category"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Club results */}
          {filteredClubs.length === 0 ? (
            <p className="empty-message">
              No clubs match your search.
            </p>
          ) : (
            <div className="club-grid">
              {filteredClubs.map((club) => {
                const membership = memberships.find(
                  (item) =>
                    Number(item.ClubID) === Number(club.ClubID) &&
                    item.MembershipStatus === "Active"
                );

                return (
                  <article
                    className="club-card"
                    key={club.ClubID}
                  >
                    <p className="club-category">
                      {club.Category || "University club"}
                    </p>

                    <h3>{club.ClubName}</h3>

                    <p className="club-description">
                      {club.Description ||
                        "Find out more about this club."}
                    </p>

                    <div className="club-actions">
                      {membership ? (
                        <button
                          className="club-action"
                          onClick={() => handleLeaveClub(club.ClubID)}
                          disabled={actionClubId === club.ClubID}
                        >
                          {actionClubId === club.ClubID
                            ? "Please wait..."
                            : "Leave club"}
                        </button>
                      ) : (
                        <button
                          className="club-action"
                          onClick={() => handleJoinClub(club.ClubID)}
                          disabled={!user || actionClubId === club.ClubID}
                        >
                          {!user
                            ? "Log in to join"
                            : actionClubId === club.ClubID
                              ? "Please wait..."
                              : "Join club"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        CampusMeet · University clubs and communities
      </footer>
    </div>
  );
}
