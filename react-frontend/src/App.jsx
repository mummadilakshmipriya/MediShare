import { useEffect, useMemo, useState } from "react";
import "./style.css";

const API_URL = "http://localhost:3001/api";

function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("donor");

  const [isSignup, setIsSignup] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [token,
     setToken] = useState("");

  const [medicines, setMedicines] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    medicineName: "",
    quantity: "",
    expiryDate: "",
    description: "",
    location: ""
  });

  async function apiRequest(path, options = {}) {
    const response = await fetch(API_URL + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: "Bearer " + token }
          : {}),
        ...(options.headers || {})
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || result.message || "Request failed."
      );
    }

    return result;
  }

  async function loadMedicines() {
    try {
      const result = await apiRequest("/medicines");
      setMedicines(
        Array.isArray(result) ? result : result.medicines || []
      );
    } catch (error) {
      console.error("Load medicines:", error);
      setMessage(error.message);
    }
  }

  async function loadRequests(currentRole = role) {
    if (!token) return;

    try {
      if (currentRole === "receiver") {
        const result = await apiRequest("/requests/my");
        setMyRequests(Array.isArray(result) ? result : []);
      } else {
        const result = await apiRequest("/requests/donor");
        setIncomingRequests(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      console.error("Load requests:", error);
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadMedicines();
  }, []);

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage(isSignup ? "Creating account..." : "Signing in...");

    try {
      const endpoint = isSignup ? "/auth/signup" : "/auth/login";

      const data = isSignup
        ? { name, email, password, role }
        : { email, password, role };

      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(data)
      });

      if (!result.token) {
        throw new Error("Authentication token was not received.");
      }

      setToken(result.token);
      setLoggedIn(true);

      if (result.user?.name) setName(result.user.name);
      if (result.user?.email) setEmail(result.user.email);
      if (result.user?.role) setRole(result.user.role);

      setPassword("");
      setMessage(
        isSignup
          ? "Account created successfully!"
          : "Login successful!"
      );

      const medicinesResult = await apiRequest("/medicines");
      setMedicines(
        Array.isArray(medicinesResult)
          ? medicinesResult
          : medicinesResult.medicines || []
      );

      // Use the returned token immediately for request loading.
      const requestPath =
        (result.user?.role || role) === "receiver"
          ? "/requests/my"
          : "/requests/donor";

      const requestResponse = await fetch(API_URL + requestPath, {
        headers: {
          Authorization: "Bearer " + result.token
        }
      });

      const requestData = await requestResponse.json();

      if (!requestResponse.ok) {
        throw new Error(
          requestData.error || "Could not load requests."
        );
      }

      if ((result.user?.role || role) === "receiver") {
        setMyRequests(Array.isArray(requestData) ? requestData : []);
      } else {
        setIncomingRequests(
          Array.isArray(requestData) ? requestData : []
        );
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function donate(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await apiRequest("/medicines", {
        method: "POST",
        body: JSON.stringify({
          name: form.medicineName,
          quantity: Number(form.quantity),
          expiryDate: form.expiryDate,
          description: form.description,
          location: form.location,
          donor: name || email
        })
      });

      setForm({
        medicineName: "",
        quantity: "",
        expiryDate: "",
        description: "",
        location: ""
      });

      setMessage("Medicine added successfully!");
      await loadMedicines();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestMedicine(medicine) {
    const medicineId = medicine._id;

    if (!medicineId) {
      setMessage("This medicine has no valid database ID.");
      return;
    }

    if (
      !window.confirm(
        "Do you want to request " +
          (medicine.name || medicine.medicineName) +
          "?"
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await apiRequest("/requests", {
        method: "POST",
        body: JSON.stringify({
          medicineId,
          message: "I would like to request this medicine."
        })
      });

      setMessage(result.message || "Medicine request submitted!");
      await loadRequests("receiver");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateRequest(requestId, status) {
    setLoading(true);
    setMessage("");

    try {
      const result = await apiRequest(
        "/requests/" + requestId + "/status",
        {
          method: "PATCH",
          body: JSON.stringify({ status })
        }
      );

      setMessage(result.message || "Request updated.");
      await loadRequests("donor");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setLoggedIn(false);
    setToken("");
    setPassword("");
    setSearch("");
    setMyRequests([]);
    setIncomingRequests([]);
    setMessage("");
  }

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  const filteredMedicines = useMemo(() => {
    const query = search.toLowerCase();

    return medicines.filter((medicine) => {
      const medicineName = (
        medicine.name || medicine.medicineName || ""
      ).toLowerCase();

      const donor = (medicine.donor || "").toLowerCase();
      const location = (medicine.location || "").toLowerCase();

      return (
        medicineName.includes(query) ||
        donor.includes(query) ||
        location.includes(query)
      );
    });
  }, [medicines, search]);

  function formatDate(date) {
    if (!date) return "Not specified";
    return String(date).slice(0, 10);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>MediShare</h1>
          <p>Share Medicines. Save Lives.</p>
        </div>

        {loggedIn && (
          <div className="header-actions">
            <span className="role-label">
              {role === "donor" ? "Donor" : "Receiver"}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="container">
        {!loggedIn ? (
          <section className="auth-section">
            <div className="auth-card">
              <h2>
                {isSignup ? "Create Your Account" : "Welcome to MediShare"}
              </h2>

              <p className="auth-description">
                {isSignup
                  ? "Join our community and help people access medicines."
                  : "Sign in to continue to your account."}
              </p>

              <form onSubmit={handleAuth} className="auth-form">
                {isSignup && (
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role">Account Type</label>
                  <select
                    id="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    <option value="donor">Medicine Donor</option>
                    <option value="receiver">Medicine Receiver</option>
                  </select>
                </div>

                <button
                  className="btn btn-primary auth-submit"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? "Please wait..."
                    : isSignup
                    ? "Create Account"
                    : "Sign In"}
                </button>
              </form>

              <p className="switch-auth">
                {isSignup
                  ? "Already have an account?"
                  : "Don't have an account?"}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setIsSignup(!isSignup);
                    setMessage("");
                  }}
                >
                  {isSignup ? "Sign In" : "Sign Up"}
                </button>
              </p>

              {message && (
                <p className="message" role="status">
                  {message}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="dashboard">
            <div className="welcome-section">
              <h2>Welcome, {name || email}!</h2>
              <p>
                {role === "donor"
                  ? "Share your unused medicines with people who need them."
                  : "Find available medicines and track your requests."}
              </p>
            </div>

            {role === "donor" && (
              <section className="medicine-form-section">
                <h2>Donate Medicine</h2>

                <form onSubmit={donate} className="medicine-form">
                  <div className="form-group">
                    <label htmlFor="medicineName">Medicine Name</label>
                    <input
                      id="medicineName"
                      name="medicineName"
                      value={form.medicineName}
                      onChange={updateForm}
                      placeholder="Enter medicine name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="quantity">Quantity</label>
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={form.quantity}
                      onChange={updateForm}
                      placeholder="Enter quantity"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="expiryDate">Expiry Date</label>
                    <input
                      id="expiryDate"
                      name="expiryDate"
                      type="date"
                      value={form.expiryDate}
                      onChange={updateForm}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="location">Location</label>
                    <input
                      id="location"
                      name="location"
                      value={form.location}
                      onChange={updateForm}
                      placeholder="Enter location"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={form.description}
                      onChange={updateForm}
                      placeholder="Additional details"
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Please wait..." : "Donate Medicine"}
                  </button>
                </form>
              </section>
            )}

            <section className="medicine-list-section">
              <h2>Available Medicines</h2>

              <input
                className="search-input"
                type="search"
                placeholder="Search medicine, donor or location..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <button
                type="button"
                className="btn btn-secondary"
                onClick={loadMedicines}
              >
                Refresh Medicines
              </button>

              {filteredMedicines.length === 0 ? (
                <p className="empty-message">
                  No medicines found. Try another search.
                </p>
              ) : (
                <div className="medicine-grid">
                  {filteredMedicines.map((medicine, index) => (
                    <article
                      className="medicine-card"
                      key={medicine._id || medicine.id || index}
                    >
                      <h3>
                        {medicine.name ||
                          medicine.medicineName ||
                          "Medicine"}
                      </h3>

                      <p>
                        <strong>Quantity:</strong>{" "}
                        {medicine.quantity ?? "Not specified"}
                      </p>
                      <p>
                        <strong>Expiry Date:</strong>{" "}
                        {formatDate(medicine.expiryDate)}
                      </p>
                      <p>
                        <strong>Location:</strong>{" "}
                        {medicine.location || "Not specified"}
                      </p>
                      <p>
                        <strong>Donor:</strong>{" "}
                        {medicine.donor || "Not specified"}
                      </p>

                      {medicine.description && (
                        <p>
                          <strong>Description:</strong>{" "}
                          {medicine.description}
                        </p>
                      )}

                      {role === "receiver" && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={loading}
                          onClick={() => requestMedicine(medicine)}
                        >
                          Request Medicine
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            {role === "receiver" && (
              <section className="medicine-list-section">
                <h2>My Requests</h2>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => loadRequests("receiver")}
                >
                  Refresh Requests
                </button>

                {myRequests.length === 0 ? (
                  <p className="empty-message">
                    You have not requested any medicines yet.
                  </p>
                ) : (
                  <div className="medicine-grid">
                    {myRequests.map((request) => (
                      <article
                        className="medicine-card"
                        key={request._id}
                      >
                        <h3>{request.medicineName}</h3>
                        <p>
                          <strong>Donor:</strong>{" "}
                          {request.donorName || "Not specified"}
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {request.status}
                        </p>
                        <p>
                          <strong>Requested:</strong>{" "}
                          {formatDate(request.createdAt)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {role === "donor" && (
              <section className="medicine-list-section">
                <h2>Incoming Requests</h2>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => loadRequests("donor")}
                >
                  Refresh Requests
                </button>

                {incomingRequests.length === 0 ? (
                  <p className="empty-message">
                    No medicine requests yet.
                  </p>
                ) : (
                  <div className="medicine-grid">
                    {incomingRequests.map((request) => (
                      <article
                        className="medicine-card"
                        key={request._id}
                      >
                        <h3>{request.medicineName}</h3>
                        <p>
                          <strong>Receiver:</strong>{" "}
                          {request.receiverEmail}
                        </p>
                        <p>
                          <strong>Message:</strong>{" "}
                          {request.message || "No message"}
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          {request.status}
                        </p>

                        {request.status === "pending" && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "10px",
                              marginTop: "15px"
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={loading}
                              onClick={() =>
                                updateRequest(request._id, "accepted")
                              }
                            >
                              Accept
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={loading}
                              onClick={() =>
                                updateRequest(request._id, "rejected")
                              }
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {message && (
              <p className="message" role="status">
                {message}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>MediShare © 2026 | Share Care, Save Lives</p>
      </footer>
    </div>
  );
}

export default App;
