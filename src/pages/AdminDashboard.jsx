import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { auth } from "../services/firebase";
import api from "../services/api";

import "../styles/vault.css";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [view, setView] = useState("users");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");

  const [adminEmail, setAdminEmail] = useState("");

  const [consoleLines, setConsoleLines] = useState([]);

  const [dark, setDark] = useState(false);

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("vault-theme");

    const isDark = savedTheme === "dark";

    setDark(isDark);

    document.documentElement.dataset.theme =
      isDark ? "dark" : "light";

    setAdminEmail(
      auth.currentUser?.email || ""
    );

    loadDashboard();
  }, []);

  /* =====================================================
     THEME
  ===================================================== */

  const toggleTheme = () => {
    const next = !dark;

    setDark(next);

    document.documentElement.dataset.theme =
      next ? "dark" : "light";

    localStorage.setItem(
      "vault-theme",
      next ? "dark" : "light"
    );
  };

  /* =====================================================
     CONSOLE
  ===================================================== */

  const addConsole = (
    message,
    type = "info"
  ) => {
    const time =
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }
      );

    setConsoleLines((previous) => [
      ...previous.slice(-50),
      {
        time,
        message,
        type,
      },
    ]);
  };

  /* =====================================================
     LOAD DATA
  ===================================================== */

  const loadDashboard = async () => {
    setLoading(true);

    try {
      const [
        usersResponse,
        filesResponse,
      ] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/files"),
      ]);

      const loadedUsers =
        usersResponse.data?.users || [];

      const loadedFiles =
        filesResponse.data?.files || [];

      setUsers(loadedUsers);
      setFiles(loadedFiles);

      addConsole(
        "RÉTROVA administration interface synchronized.",
        "ok"
      );

    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );

      addConsole(
        "Failed to synchronize administration data.",
        "error"
      );

    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     USER FILES
  ===================================================== */

  const getUserFiles = (user) => {
    if (!user) return [];

    return files.filter(
      (file) =>
        file.ownerId === user.uid ||
        file.ownerEmail === user.email
    );
  };

  /* =====================================================
     USER SELECTION
  ===================================================== */

  const openUser = (user) => {
    setSelectedUser(user);
    setSelectedFile(null);

    setView("user");

    addConsole(
      `Opened account: ${user.email}`,
      "info"
    );
  };

  /* =====================================================
     FILE SELECTION
  ===================================================== */

  const openFile = (file) => {
    setSelectedFile(file);

    setView("file");

    addConsole(
      `Inspecting ${file.fileName}`,
      "info"
    );
  };

  /* =====================================================
     BACK TO USERS
  ===================================================== */

  const backToUsers = () => {
    setSelectedUser(null);
    setSelectedFile(null);

    setView("users");

    addConsole(
      "Returned to user directory.",
      "info"
    );
  };

  /* =====================================================
     BACK TO USER
  ===================================================== */

  const backToUser = () => {
    setSelectedFile(null);

    setView("user");

    addConsole(
      `Returned to ${selectedUser?.email || "user"} account.`,
      "info"
    );
  };

  /* =====================================================
     VERIFY INTEGRITY
  ===================================================== */

  const verifyIntegrity = async () => {
    if (!selectedFile) return;

    setWorking(
      `verify-${selectedFile.fileId}`
    );

    addConsole(
      `Integrity verification started: ${selectedFile.fileName}`,
      "info"
    );

    try {
      const response =
        await api.post(
          `/admin/files/${selectedFile.fileId}/verify`
        );

      const updatedFile =
        response.data?.file ||
        response.data?.data;

      /*
       * Update local file data.
       */

      if (updatedFile) {
        setSelectedFile(updatedFile);

        setFiles((previous) =>
          previous.map((file) =>
            file.fileId === updatedFile.fileId
              ? updatedFile
              : file
          )
        );
      }

      /*
       * Print replica results.
       */

      const replicas =
        updatedFile?.replicas ||
        selectedFile.replicas;

      if (replicas) {
        Object.values(replicas).forEach(
          (replica) => {
            addConsole(
              `${replica.node} ........ ${replica.status}`,
              replica.status === "HEALTHY"
                ? "ok"
                : "error"
            );
          }
        );
      }

      addConsole(
        `Integrity verification completed: ${selectedFile.fileName}`,
        "ok"
      );

      await loadDashboard();

    } catch (error) {
      console.error(
        "Integrity verification failed:",
        error
      );

      addConsole(
        `Integrity verification failed: ${
          error.response?.data?.message ||
          error.message
        }`,
        "error"
      );

    } finally {
      setWorking("");
    }
  };

  /* =====================================================
     CORRUPTION TEST
  ===================================================== */

  const testCorruption = async (node) => {
    if (!selectedFile) return;

    const confirmed =
      window.confirm(
        `Simulate corruption on ${node}?\n\nRÉTROVA will intentionally corrupt this replica and automatically repair it.`
      );

    if (!confirmed) return;

    setWorking(
      `corrupt-${selectedFile.fileId}-${node}`
    );

    addConsole(
      `⚠ Corruption simulation started on ${node}`,
      "warn"
    );

    addConsole(
      `Writing corrupted data to ${node}...`,
      "warn"
    );

    try {
      const response =
        await api.post(
          `/admin/files/${selectedFile.fileId}/test-corruption/${node}`
        );

      /*
       * Corruption information
       */

      const corruption =
        response.data?.corruption;

      if (corruption) {
        addConsole(
          `${node} checksum mismatch detected`,
          "error"
        );

        addConsole(
          `Expected: ${corruption.expectedChecksum}`,
          "warn"
        );

        addConsole(
          `Actual: ${corruption.corruptedChecksum}`,
          "error"
        );
      }

      /*
       * Repair
       */

      addConsole(
        `Repair initiated for ${node}`,
        "info"
      );

      const repair =
        response.data?.repair;

      if (repair?.sourceNode) {
        addConsole(
          `Using ${repair.sourceNode} as repair source`,
          "info"
        );
      }

      addConsole(
        `Repairing ${node}...`,
        "warn"
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 700)
      );

      if (repair?.success) {
        addConsole(
          `${node} checksum verified`,
          "ok"
        );

        addConsole(
          `${node} RESTORED — replica healthy`,
          "ok"
        );

        addConsole(
          "Automatic repair completed successfully.",
          "ok"
        );
      } else {
        addConsole(
          `Repair failed for ${node}`,
          "error"
        );
      }

      /*
       * Refresh data
       */

      await loadDashboard();

      /*
       * Find updated selected file
       */

      const refreshedFile =
        files.find(
          (file) =>
            file.fileId ===
            selectedFile.fileId
        );

      if (refreshedFile) {
        setSelectedFile(refreshedFile);
      }

    } catch (error) {
      console.error(
        "Corruption test failed:",
        error
      );

      addConsole(
        `Corruption test failed: ${
          error.response?.data?.message ||
          error.message
        }`,
        "error"
      );

    } finally {
      setWorking("");
    }
  };

  /* =====================================================
     MANUAL REPAIR
  ===================================================== */

  const manualRepair = async (node) => {
    if (!selectedFile) return;

    setWorking(
      `repair-${selectedFile.fileId}-${node}`
    );

    addConsole(
      `Manual repair requested for ${node}`,
      "info"
    );

    try {
      const response =
        await api.post(
          `/admin/files/${selectedFile.fileId}/repair/${node}`
        );

      if (response.data?.success) {
        addConsole(
          `${node} manually repaired successfully.`,
          "ok"
        );
      }

      await loadDashboard();

    } catch (error) {
      console.error(
        "Manual repair failed:",
        error
      );

      addConsole(
        `Manual repair failed for ${node}`,
        "error"
      );

    } finally {
      setWorking("");
    }
  };

  /* =====================================================
     LOGOUT
  ===================================================== */

  const logout = async () => {
    await signOut(auth);

    navigate("/");
  };

  /* =====================================================
     FILTER USERS
  ===================================================== */

  const filteredUsers = useMemo(() => {

    const query =
      search.trim().toLowerCase();

    if (!query) return users;

    return users.filter(
      (user) =>
        user.email
          ?.toLowerCase()
          .includes(query)
    );

  }, [users, search]);

  /* =====================================================
     SELECTED USER FILES
  ===================================================== */

  const selectedUserFiles =
    useMemo(
      () =>
        getUserFiles(selectedUser),
      [selectedUser, files]
    );

  /* =====================================================
     USER STORAGE
  ===================================================== */

  const selectedUserStorage =
    selectedUserFiles.reduce(
      (total, file) =>
        total + (file.size || 0),
      0
    );

  /* =====================================================
     USER HEALTH
  ===================================================== */

  const selectedUserReplicaHealth =
    selectedUserFiles.reduce(
      (result, file) => {

        if (!file.replicas) {
          return result;
        }

        Object.values(
          file.replicas
        ).forEach((replica) => {

          result.total += 1;

          if (
            replica.status ===
            "HEALTHY"
          ) {
            result.healthy += 1;
          }

        });

        return result;

      },
      {
        healthy: 0,
        total: 0,
      }
    );

  const healthPercentage =
    selectedUserReplicaHealth.total === 0
      ? 100
      : Math.round(
          (selectedUserReplicaHealth.healthy /
            selectedUserReplicaHealth.total) *
            100
        );

  /* =====================================================
     STATUS COMPONENT
  ===================================================== */

  const Status = ({ status }) => {

    let className =
      "status status-healthy";

    if (
      status === "CORRUPTED" ||
      status === "OFFLINE" ||
      status === "MISSING"
    ) {
      className =
        "status status-danger";
    }

    if (
      status === "REPAIRING" ||
      status === "DEGRADED"
    ) {
      className =
        "status status-warning";
    }

    return (
      <span className={className}>

        <span className="status-dot" />

        {status || "UNKNOWN"}

      </span>
    );
  };

  /* =====================================================
     HEADER
  ===================================================== */

  const Header = () => (

    <nav className="vault-nav vault-glass">

      <div className="vault-brand">

        <div className="vault-logo">
          R
        </div>

        <div>

          <div className="vault-brand-title">
            RÉTROVA
          </div>

          <div className="vault-brand-subtitle">
            Admin Control Center
          </div>

        </div>

      </div>

      <div className="vault-nav-actions">

        <div className="admin-account">

          <div className="admin-avatar">
            {adminEmail
              ? adminEmail[0].toUpperCase()
              : "A"}
          </div>

          <div className="admin-account-info">

            <div className="admin-account-email">
              {adminEmail || "Administrator"}
            </div>

            <div className="admin-account-role">
              Administrator
            </div>

          </div>

        </div>

        <button
          className="vault-btn vault-btn-ghost"
          type="button"
          onClick={logout}
        >
          Logout
        </button>

      </div>

    </nav>
  );

  /* =====================================================
     USERS VIEW
  ===================================================== */

  const UsersView = () => (

    <>
      <section className="vault-hero vault-glass">

        <div className="vault-eyebrow">
          Administration
        </div>

        <h1>
          User Directory
        </h1>

        <p>
          Select an account to inspect its stored
          objects, replica health and integrity.
        </p>

      </section>

      <section className="section">

        <div className="section-header">

          <div>

            <div className="section-title">
              Accounts
            </div>

            <div className="section-description">
              {users.length} registered accounts
            </div>

          </div>

          <span className="status status-healthy">
            <span className="status-dot" />
            System Online
          </span>

        </div>

        {/* Search */}

        <div
          className="vault-glass"
          style={{
            padding: 12,
            borderRadius: 15,
            marginBottom: 14,
          }}
        >

          <input
            className="form-input"
            style={{
              width: "100%",
            }}
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search user accounts..."
          />

        </div>

        {loading ? (

          <div className="vault-card vault-glass">
            Loading accounts...
          </div>

        ) : filteredUsers.length === 0 ? (

          <div className="empty-state vault-glass">

            <div className="empty-icon">
              ♙
            </div>

            <h3>
              No users found
            </h3>

            <p>
              Try another email address.
            </p>

          </div>

        ) : (

          <div className="file-list">

            {filteredUsers.map(
              (user) => {

                const userFiles =
                  getUserFiles(user);

                const healthy =
                  userFiles.reduce(
                    (total, file) => {

                      if (!file.replicas) {
                        return total;
                      }

                      return (
                        total +
                        Object.values(
                          file.replicas
                        ).filter(
                          (replica) =>
                            replica.status ===
                            "HEALTHY"
                        ).length
                      );

                    },
                    0
                  );

                const replicaTotal =
                  userFiles.length * 4;

                return (

                  <button
                    key={user.uid}
                    type="button"
                    className="admin-user-card vault-glass"
                    onClick={() =>
                      openUser(user)
                    }
                  >

                    <div className="admin-user-avatar">
                      {user.email
                        ? user.email[0].toUpperCase()
                        : "U"}
                    </div>

                    <div className="admin-user-info">

                      <div className="admin-user-email">
                        {user.email}
                      </div>

                      <div className="admin-user-meta">

                        <span>
                          {userFiles.length}{" "}
                          {userFiles.length === 1
                            ? "file"
                            : "files"}
                        </span>

                        <span>
                          {healthy}/
                          {replicaTotal || 0} replicas healthy
                        </span>

                      </div>

                    </div>

                    <div className="admin-user-arrow">
                      →
                    </div>

                  </button>

                );
              }
            )}

          </div>

        )}

      </section>
    </>
  );

  /* =====================================================
     USER VIEW
  ===================================================== */

  const UserView = () => (

    <>
      <div className="admin-breadcrumb">

        <button
          type="button"
          onClick={backToUsers}
        >
          ← Users
        </button>

        <span>
          / {selectedUser?.email}
        </span>

      </div>

      <section className="vault-hero vault-glass">

        <div className="vault-eyebrow">
          User Account
        </div>

        <h1>
          {selectedUser?.email}
        </h1>

        <p>
          Inspect files, replica health and
          integrity for this account.
        </p>

      </section>

      {/* USER STATS */}

      <section className="stats-grid">

        <div className="stat-card vault-glass">

          <div className="stat-label">
            Files
          </div>

          <div className="stat-value">
            {selectedUserFiles.length}
          </div>

          <div className="stat-note">
            Stored objects
          </div>

        </div>

        <div className="stat-card vault-glass">

          <div className="stat-label">
            Storage
          </div>

          <div className="stat-value">
            {formatSize(
              selectedUserStorage
            )}
          </div>

          <div className="stat-note">
            Total object size
          </div>

        </div>

        <div className="stat-card vault-glass">

          <div className="stat-label">
            Replicas
          </div>

          <div className="stat-value">
            {selectedUserReplicaHealth.healthy}
            /
            {selectedUserReplicaHealth.total}
          </div>

          <div className="stat-note">
            Healthy replicas
          </div>

        </div>

        <div className="stat-card vault-glass">

          <div className="stat-label">
            Health
          </div>

          <div className="stat-value">
            {healthPercentage}%
          </div>

          <div className="stat-note">
            Replica integrity
          </div>

        </div>

      </section>

      {/* USER FILES */}

      <section className="section">

        <div className="section-header">

          <div>

            <div className="section-title">
              Stored Objects
            </div>

            <div className="section-description">
              Select an object to inspect its replicas.
            </div>

          </div>

        </div>

        {selectedUserFiles.length === 0 ? (

          <div className="empty-state vault-glass">

            <div className="empty-icon">
              ◇
            </div>

            <h3>
              No files
            </h3>

            <p>
              This account has no stored objects.
            </p>

          </div>

        ) : (

          <div className="file-list">

            {selectedUserFiles.map(
              (file) => (

                <button
                  key={file.fileId}
                  type="button"
                  className="admin-file-card vault-glass"
                  onClick={() =>
                    openFile(file)
                  }
                >

                  <div className="file-icon">
                    ◇
                  </div>

                  <div className="file-info">

                    <div className="file-name">
                      {file.fileName}
                    </div>

                    <div className="file-meta">
                      {formatSize(file.size)}
                      {" · "}
                      {file.replicaCount || 4} replicas
                    </div>

                  </div>

                  <Status
                    status={
                      file.status ||
                      "HEALTHY"
                    }
                  />

                  <span className="admin-user-arrow">
                    →
                  </span>

                </button>

              )
            )}

          </div>

        )}

      </section>
    </>
  );

  /* =====================================================
     FILE VIEW
  ===================================================== */

  const FileView = () => {

    if (!selectedFile) {
      return null;
    }

    const replicas =
      selectedFile.replicas || {};

    return (

      <>

        {/* Breadcrumb */}

        <div className="admin-breadcrumb">

          <button
            type="button"
            onClick={backToUsers}
          >
            Users
          </button>

          <span>
            /
          </span>

          <button
            type="button"
            onClick={backToUser}
          >
            {selectedUser?.email}
          </button>

          <span>
            / {selectedFile.fileName}
          </span>

        </div>

        {/* FILE HEADER */}

        <section className="vault-hero vault-glass">

          <div className="vault-eyebrow">
            Object Inspection
          </div>

          <h1>
            {selectedFile.fileName}
          </h1>

          <p>
            Owned by {selectedUser?.email}
          </p>

          <div
            style={{
              marginTop: 17,
            }}
          >

            <Status
              status={
                selectedFile.status ||
                "HEALTHY"
              }
            />

          </div>

        </section>

        {/* FILE INFORMATION */}

        <section className="vault-card vault-glass">

          <div className="section-title">
            Object Information
          </div>

          <div className="object-info-grid">

            <div>
              <div className="object-label">
                File Name
              </div>

              <div className="object-value">
                {selectedFile.fileName}
              </div>
            </div>

            <div>
              <div className="object-label">
                Size
              </div>

              <div className="object-value">
                {formatSize(
                  selectedFile.size
                )}
              </div>
            </div>

            <div>
              <div className="object-label">
                Content Type
              </div>

              <div className="object-value">
                {selectedFile.contentType ||
                  "Unknown"}
              </div>
            </div>

            <div>
              <div className="object-label">
                Replication
              </div>

              <div className="object-value">
                4 logical replicas
              </div>
            </div>

          </div>

          {/* CHECKSUM */}

          <div
            className="checksum-box"
          >

            <div className="object-label">
              SHA-256 INTEGRITY CHECKSUM
            </div>

            <div className="checksum-value">
              {selectedFile.checksum ||
                "Unavailable"}
            </div>

          </div>

        </section>

        {/* REPLICA NETWORK */}

        <section className="section">

          <div className="section-header">

            <div>

              <div className="section-title">
                Replica Network
              </div>

              <div className="section-description">
                Four logical storage replicas
              </div>

            </div>

            <button
              className="vault-btn vault-btn-primary"
              type="button"
              disabled={
                working ===
                `verify-${selectedFile.fileId}`
              }
              onClick={
                verifyIntegrity
              }
            >
              {working ===
              `verify-${selectedFile.fileId}`
                ? "Verifying..."
                : "✓ Verify Integrity"}
            </button>

          </div>

          <div className="admin-replica-grid">

            {[
              "node1",
              "node2",
              "node3",
              "node4",
            ].map((node) => {

              const replica =
                replicas[node];

              const status =
                replica?.status ||
                "MISSING";

              const isWorking =
                working ===
                `repair-${selectedFile.fileId}-${node}` ||
                working ===
                `corrupt-${selectedFile.fileId}-${node}`;

              return (

                <div
                  className="admin-replica-card vault-glass"
                  key={node}
                >

                  <div className="admin-replica-top">

                    <div>

                      <div className="replica-name">
                        {node.toUpperCase()}
                      </div>

                      <div className="replica-status">
                        Storage Replica
                      </div>

                    </div>

                    <Status
                      status={status}
                    />

                  </div>

                  <div className="replica-checksum">

                    <div>
                      CHECKSUM
                    </div>

                    <code>
                      {replica?.checksum
                        ? `${replica.checksum.slice(
                            0,
                            18
                          )}...`
                        : "Unavailable"}
                    </code>

                  </div>

                  {/* CORRUPTED REPAIR */}

                  {[
                    "CORRUPTED",
                    "OFFLINE",
                    "MISSING",
                  ].includes(status) && (

                    <button
                      className="vault-btn vault-btn-danger"
                      type="button"
                      disabled={Boolean(
                        working
                      )}
                      onClick={() =>
                        manualRepair(node)
                      }
                    >
                      {isWorking
                        ? "Repairing..."
                        : `Repair ${node}`}
                    </button>

                  )}

                  {/* DEMO CORRUPTION */}

                  {status === "HEALTHY" && (

                    <button
                      className="vault-btn vault-btn-soft"
                      type="button"
                      disabled={Boolean(
                        working
                      )}
                      onClick={() =>
                        testCorruption(node)
                      }
                    >
                      {isWorking
                        ? "Testing..."
                        : `Test ${node}`}
                    </button>

                  )}

                </div>

              );

            })}

          </div>

        </section>

        {/* SYSTEM CONSOLE */}

        <section className="section">

          <div className="section-header">

            <div>

              <div className="section-title">
                System Console
              </div>

              <div className="section-description">
                Live integrity and recovery activity
              </div>

            </div>

          </div>

          <div className="console">

            <div className="console-header">

              <div className="console-title">
                RÉTROVA Runtime
              </div>

              <div className="console-dots">
                <span />
                <span />
                <span />
              </div>

            </div>

            <div className="console-body">

              {consoleLines.length === 0 ? (

                <div className="console-line">

                  <span className="console-time">
                    --
                  </span>

                  <span className="console-info">
                    Waiting for system activity...
                  </span>

                </div>

              ) : (

                consoleLines.map(
                  (line, index) => (

                    <div
                      className="console-line"
                      key={index}
                    >

                      <span className="console-time">
                        [{line.time}]
                      </span>

                      <span
                        className={
                          line.type === "ok"
                            ? "console-ok"
                            : line.type ===
                              "warn"
                            ? "console-warn"
                            : line.type ===
                              "error"
                            ? "console-error"
                            : "console-info"
                        }
                      >
                        {line.message}
                      </span>

                    </div>

                  )
                )

              )}

            </div>

          </div>

        </section>

      </>

    );
  };

  /* =====================================================
     FORMAT SIZE
  ===================================================== */

  function formatSize(bytes) {

    if (!bytes) return "0 B";

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index = Math.floor(
      Math.log(bytes) /
        Math.log(1024)
    );

    return `${(
      bytes /
      Math.pow(1024, index)
    ).toFixed(
      index === 0 ? 0 : 2
    )} ${units[index]}`;
  }

  /* =====================================================
     MAIN
  ===================================================== */

  return (

    <div className="vault-page page-enter">

      <div className="vault-container">

        <Header />

        {view === "users" && (
          <UsersView />
        )}

        {view === "user" && (
          <UserView />
        )}

        {view === "file" && (
          <FileView />
        )}

      </div>

      {/* THEME */}

      <button
        className="theme-switcher"
        type="button"
        onClick={toggleTheme}
        title="Change theme"
      >
        {dark ? "☀" : "◐"}
      </button>

    </div>
  );
}