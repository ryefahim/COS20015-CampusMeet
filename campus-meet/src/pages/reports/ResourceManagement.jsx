
import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import "./styles/ResourceManagement.css";


const ResourceManagement = () => {
  const [resources, setResources] = useState([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [resourceType, setResourceType] = useState("All");
  const [bookingStatus, setBookingStatus] = useState("All");
  const [search, setSearch] = useState("");

  const [sortField, setSortField] = useState("ResourceName");
  const [sortDirection, setSortDirection] = useState("asc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("access_token");


  // --------------------------------------------------
  // Load report
  // --------------------------------------------------

  const loadReport = async (filters = {}) => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/api/reports/resource-management",
        {
          params: {
            start_date: filters.startDate || undefined,
            end_date: filters.endDate || undefined,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setResources(response.data.data || []);

    } catch (err) {
      console.error("Resource report error:", err);

      setError(
        err.response?.data?.detail ||
        "Unable to load the resource management report."
      );

    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadReport();
  }, []);


  // --------------------------------------------------
  // Filters
  // --------------------------------------------------

  const handleApplyFilters = () => {
    if (startDate && endDate && startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    loadReport({
      startDate,
      endDate,
    });
  };


  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setResourceType("All");
    setBookingStatus("All");
    setSearch("");

    loadReport({});
  };


  // --------------------------------------------------
  // Resource types
  // --------------------------------------------------

  const resourceTypes = useMemo(() => {
    return [
      ...new Set(
        resources
          .map((resource) => resource.ResourceType)
          .filter(Boolean)
      ),
    ].sort();
  }, [resources]);


  // --------------------------------------------------
  // Search, filtering and sorting
  // --------------------------------------------------

  const filteredResources = useMemo(() => {
    let result = [...resources];

    if (resourceType !== "All") {
      result = result.filter(
        (resource) => resource.ResourceType === resourceType
      );
    }

    if (bookingStatus !== "All") {
      const statusField = {
        Approved: "ApprovedBookings",
        Pending: "PendingBookings",
        Cancelled: "CancelledBookings",
        Completed: "CompletedBookings",
      }[bookingStatus];

      result = result.filter(
        (resource) => Number(resource[statusField]) > 0
      );
    }

    if (search.trim()) {
      const term = search.toLowerCase();

      result = result.filter((resource) =>
        [
          resource.ResourceName,
          resource.ResourceType,
          resource.ClubName,
          resource.SupplierName,
          resource.SupplierServiceType,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(term)
          )
      );
    }

    result.sort((a, b) => {
      let valueA = a[sortField];
      let valueB = b[sortField];

      if (typeof valueA === "string") {
        valueA = valueA.toLowerCase();
        valueB = (valueB || "").toLowerCase();
      }

      if (valueA < valueB) {
        return sortDirection === "asc" ? -1 : 1;
      }

      if (valueA > valueB) {
        return sortDirection === "asc" ? 1 : -1;
      }

      return 0;
    });

    return result;
  }, [
    resources,
    resourceType,
    bookingStatus,
    search,
    sortField,
    sortDirection,
  ]);


  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(
        sortDirection === "asc" ? "desc" : "asc"
      );
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };


  // --------------------------------------------------
  // Summary statistics
  // --------------------------------------------------

  const totalResources = filteredResources.length;

  const totalQuantity = filteredResources.reduce(
    (sum, resource) => sum + Number(resource.Quantity || 0),
    0
  );

  const totalBookings = filteredResources.reduce(
    (sum, resource) => sum + Number(resource.TotalBookings || 0),
    0
  );

  const pendingBookings = filteredResources.reduce(
    (sum, resource) => sum + Number(resource.PendingBookings || 0),
    0
  );

  const approvedBookings = filteredResources.reduce(
    (sum, resource) => sum + Number(resource.ApprovedBookings || 0),
    0
  );


  // --------------------------------------------------
  // Export CSV
  // --------------------------------------------------

  const handleExportCSV = () => {
    const headers = [
      "Resource ID",
      "Resource Name",
      "Resource Type",
      "Quantity",
      "Club",
      "Supplier",
      "Supplier Email",
      "Supplier Service",
      "Total Bookings",
      "Approved Bookings",
      "Pending Bookings",
      "Cancelled Bookings",
      "Completed Bookings",
    ];

    const rows = filteredResources.map((resource) => [
      resource.ResourceID,
      resource.ResourceName,
      resource.ResourceType || "",
      resource.Quantity ?? "",
      resource.ClubName || "",
      resource.SupplierName || "",
      resource.SupplierEmail || "",
      resource.SupplierServiceType || "",
      resource.TotalBookings,
      resource.ApprovedBookings,
      resource.PendingBookings,
      resource.CancelledBookings,
      resource.CompletedBookings,
    ]);

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");

    const blob = new Blob(
      [csvContent],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "resource-management-report.csv";
    link.click();

    URL.revokeObjectURL(url);
  };


  // --------------------------------------------------
  // Formatters
  // --------------------------------------------------

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString();
  };


  const getStatusBadge = (resource) => {
    const statuses = [
      {
        name: "Pending",
        count: resource.PendingBookings,
      },
      {
        name: "Approved",
        count: resource.ApprovedBookings,
      },
      {
        name: "Completed",
        count: resource.CompletedBookings,
      },
      {
        name: "Cancelled",
        count: resource.CancelledBookings,
      },
    ];

    return statuses.filter((status) => Number(status.count) > 0);
  };


  // --------------------------------------------------
  // Page
  // --------------------------------------------------

  return (
    <div className="resource-report-page">

      <div className="resource-report-header">

        <div>
          <button
            className="resource-back-button"
            onClick={() => {
              window.location.href = "/admin";
            }}
          >
            ← Back to Dashboard
          </button>

          <h1>Resource Management Report</h1>

          <p>
            Monitor resource inventory, suppliers and booking activity.
          </p>
        </div>

        <div className="resource-header-actions">
          <button
            className="resource-export-button"
            onClick={handleExportCSV}
            disabled={filteredResources.length === 0}
          >
            Export CSV
          </button>

          <button
            className="resource-print-button"
            onClick={() => window.print()}
          >
            Print / PDF
          </button>
        </div>

      </div>


      {/* Filters */}

      <section className="resource-filter-panel">

        <div className="resource-filter-heading">
          <h2>Report Filters</h2>
          <span>Filter resource and booking information</span>
        </div>

        <div className="resource-filter-grid">

          <div className="resource-filter-field">
            <label>Booking Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="resource-filter-field">
            <label>Booking End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="resource-filter-field">
            <label>Resource Type</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            >
              <option value="All">All Types</option>

              {resourceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="resource-filter-field">
            <label>Booking Status</label>
            <select
              value={bookingStatus}
              onChange={(e) => setBookingStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

        </div>

        <div className="resource-filter-bottom">

          <div className="resource-filter-field resource-search-field">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search resource, club or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="resource-filter-buttons">
            <button
              className="resource-apply-button"
              onClick={handleApplyFilters}
            >
              Apply Date Filters
            </button>

            <button
              className="resource-clear-button"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          </div>

        </div>

      </section>


      {error && (
        <div className="resource-error">
          {error}
        </div>
      )}


      {/* Summary Cards */}

      <section className="resource-summary-grid">

        <div className="resource-summary-card">
          <span>Total Resource Records</span>
          <h2>{formatNumber(totalResources)}</h2>
          <p>Different resource entries</p>
        </div>

        <div className="resource-summary-card">
          <span>Total Stock Quantity</span>
          <h2>{formatNumber(totalQuantity)}</h2>
          <p>Combined quantity across resources</p>
        </div>

        <div className="resource-summary-card">
          <span>Total Bookings</span>
          <h2>{formatNumber(totalBookings)}</h2>
          <p>Resource booking records</p>
        </div>

        <div className="resource-summary-card">
          <span>Pending Bookings</span>
          <h2>{formatNumber(pendingBookings)}</h2>
          <p>Awaiting approval</p>
        </div>

        <div className="resource-summary-card">
          <span>Approved Bookings</span>
          <h2>{formatNumber(approvedBookings)}</h2>
          <p>Approved resource bookings</p>
        </div>

      </section>


      {/* Resource Table */}

      <section className="resource-table-panel">

        <div className="resource-table-heading">
          <div>
            <h2>Resource Inventory</h2>
            <p>
              Showing {filteredResources.length} of {resources.length} resources
            </p>
          </div>
        </div>


        {loading ? (
          <div className="resource-loading">
            Loading resource report...
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="resource-empty">
            No resources found for the selected filters.
          </div>
        ) : (

          <div className="resource-table-wrapper">

            <table className="resource-table">

              <thead>
                <tr>
                  <th onClick={() => handleSort("ResourceID")}>
                    ID
                  </th>

                  <th onClick={() => handleSort("ResourceName")}>
                    Resource
                  </th>

                  <th onClick={() => handleSort("ResourceType")}>
                    Type
                  </th>

                  <th onClick={() => handleSort("Quantity")}>
                    Quantity
                  </th>

                  <th>Club</th>

                  <th>Supplier</th>

                  <th onClick={() => handleSort("TotalBookings")}>
                    Total Bookings
                  </th>

                  <th>Booking Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredResources.map((resource) => (
                  <tr key={resource.ResourceID}>

                    <td>
                      #{resource.ResourceID}
                    </td>

                    <td>
                      <div className="resource-name-cell">
                        <strong>{resource.ResourceName}</strong>
                        <small>
                          {resource.SupplierServiceType || "No service type"}
                        </small>
                      </div>
                    </td>

                    <td>
                      <span className="resource-type-tag">
                        {resource.ResourceType || "Uncategorised"}
                      </span>
                    </td>

                    <td className="resource-quantity">
                      {formatNumber(resource.Quantity)}
                    </td>

                    <td>
                      {resource.ClubName || "Unassigned"}
                    </td>

                    <td>
                      <div className="resource-supplier-cell">
                        <strong>
                          {resource.SupplierName || "No supplier"}
                        </strong>

                        {resource.SupplierEmail && (
                          <small>{resource.SupplierEmail}</small>
                        )}
                      </div>
                    </td>

                    <td>
                      {formatNumber(resource.TotalBookings)}
                    </td>

                    <td>
                      <div className="resource-status-list">
                        {getStatusBadge(resource).length > 0 ? (
                          getStatusBadge(resource).map((status) => (
                            <span
                              key={status.name}
                              className={`resource-status-badge ${status.name.toLowerCase()}`}
                            >
                              {status.name}: {status.count}
                            </span>
                          ))
                        ) : (
                          <span className="resource-no-bookings">
                            No bookings
                          </span>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

      </section>

    </div>
  );
};


export default ResourceManagement;
