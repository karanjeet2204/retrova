import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { auth } from "../services/firebase";
import api from "../services/api";

import "../styles/vault.css";

export default function UserDashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState({});

  const [dragActive, setDragActive] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [dark, setDark] = useState(false);

  /* =====================================================
     THEME
  ===================================================== */

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("vault-theme");

    const isDark =
      savedTheme === "dark";

    setDark(isDark);

    document.documentElement.dataset.theme =
      isDark ? "dark" : "light";
  }, []);

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
     LOAD DASHBOARD
  ===================================================== */

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    try {
      const [meResponse, filesResponse] =
        await Promise.all([
          api.get("/auth/me"),
          api.get("/files"),
        ]);

      setUser(
        meResponse.data?.user ||
        meResponse.data ||
        null
      );

      setFiles(
        filesResponse.data?.files ||
        []
      );

    } catch (error) {
      console.error(
        "Dashboard loading error:",
        error
      );

      showMessage(
        "Unable to load your dashboard.",
        "error"
      );

    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     MESSAGES
  ===================================================== */

  const showMessage = (
    text,
    type = "success"
  ) => {
    setMessage(text);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
    }, 4500);
  };

  /* =====================================================
     UPLOAD
  ===================================================== */

  const handleFileSelect = (file) => {
    if (!file) return;

    uploadFile(file);
  };

  const handleInputChange = (event) => {
    const file =
      event.target.files?.[0];

    if (file) {
      uploadFile(file);
    }

    event.target.value = "";
  };

  const uploadFile = async (file) => {
    if (uploading) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();

    formData.append(
      "file",
      file
    );

    try {
      await api.post(
        "/files/upload",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },

          onUploadProgress:
            (progressEvent) => {

              if (!progressEvent.total) {
                return;
              }

              const percentage =
                Math.round(
                  (progressEvent.loaded /
                    progressEvent.total) *
                    100
                );

              setUploadProgress(
                percentage
              );
            },
        }
      );

      setUploadProgress(100);

      showMessage(
        `${file.name} uploaded and replicated successfully.`,
        "success"
      );

      await loadDashboard();

    } catch (error) {
      console.error(
        "Upload failed:",
        error
      );

      showMessage(
        error.response?.data?.message ||
          "Upload failed. Please try again.",
        "error"
      );

    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 700);
    }
  };

  /* =====================================================
     DRAG AND DROP
  ===================================================== */

  const handleDragOver = (event) => {
    event.preventDefault();

    if (!uploading) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();

    setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();

    setDragActive(false);

    if (uploading) return;

    const file =
      event.dataTransfer.files?.[0];

    if (file) {
      uploadFile(file);
    }
  };

  /* =====================================================
     DOWNLOAD
  ===================================================== */

  const downloadFile = async (file) => {

    setDownloadProgress((previous) => ({
      ...previous,
      [file.fileId]: 0,
    }));

    try {

      const response =
        await api.get(
          `/files/${file.fileId}/download`,
          {
            responseType: "blob",

            onDownloadProgress:
              (progressEvent) => {

                if (!progressEvent.total) {
                  return;
                }

                const percentage =
                  Math.round(
                    (progressEvent.loaded /
                      progressEvent.total) *
                      100
                  );

                setDownloadProgress(
                  (previous) => ({
                    ...previous,
                    [file.fileId]:
                      percentage,
                  })
                );
              },
          }
        );

      const blob =
        new Blob([
          response.data,
        ]);

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        file.fileName;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

      setDownloadProgress(
        (previous) => ({
          ...previous,
          [file.fileId]: 100,
        })
      );

      showMessage(
        `${file.fileName} downloaded successfully.`,
        "success"
      );

    } catch (error) {

      console.error(
        "Download failed:",
        error
      );

      showMessage(
        error.response?.data?.message ||
          "Download failed.",
        "error"
      );

      setDownloadProgress(
        (previous) => {
          const next = {
            ...previous,
          };

          delete next[file.fileId];

          return next;
        }
      );

    } finally {

      setTimeout(() => {

        setDownloadProgress(
          (previous) => {
            const next = {
              ...previous,
            };

            delete next[file.fileId];

            return next;
          }
        );

      }, 1000);
    }
  };

  /* =====================================================
     LOGOUT
  ===================================================== */

  const logout = async () => {
    try {
      await signOut(auth);

      navigate("/");

    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );
    }
  };

  /* =====================================================
     CALCULATIONS
  ===================================================== */

  const totalStorage =
    files.reduce(
      (total, file) =>
        total + (file.size || 0),
      0
    );

  const healthyReplicas =
    files.reduce(
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

  const totalReplicas =
    files.length * 4;

  const health =
    totalReplicas === 0
      ? 100
      : Math.round(
          (healthyReplicas /
            totalReplicas) *
            100
        );

  /* =====================================================
     FORMAT SIZE
  ===================================================== */

  const formatSize = (bytes) => {

    if (!bytes) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index =
      Math.floor(
        Math.log(bytes) /
          Math.log(1024)
      );

    return `${(
      bytes /
      Math.pow(1024, index)
    ).toFixed(
      index === 0 ? 0 : 2
    )} ${units[index]}`;
  };

  /* =====================================================
     STATUS
  ===================================================== */

  const Status = ({
    status,
  }) => {

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

        {status || "HEALTHY"}

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
            Distributed Object Storage
          </div>

        </div>

      </div>

      <div className="vault-nav-actions">

        <div className="user-account">

          <div className="user-avatar">
            {(
              user?.email ||
              auth.currentUser?.email ||
              "U"
            )[0].toUpperCase()}
          </div>

          <div className="user-account-info">

            <div className="user-account-email">
              {user?.email ||
                auth.currentUser?.email ||
                "User"}
            </div>

            <div className="user-account-role">
              USER ACCOUNT
            </div>

          </div>

        </div>

        <button
          type="button"
          className="vault-btn vault-btn-ghost"
          onClick={logout}
        >
          Logout
        </button>

      </div>

    </nav>
  );

  /* =====================================================
     UPLOAD AREA
  ===================================================== */

  const UploadArea = () => (

    <section className="user-upload-section">

      <div className="section-header">

        <div>

          <div className="section-title">
            Upload a file
          </div>

          <div className="section-description">
            Your file will be replicated across
            four logical storage nodes.
          </div>

        </div>

      </div>

      <div
        className={`user-upload-card vault-glass ${
          dragActive
            ? "upload-drag-active"
            : ""
        } ${
          uploading
            ? "uploading"
            : ""
        }`}
        onDragOver={
          handleDragOver
        }
        onDragLeave={
          handleDragLeave
        }
        onDrop={
          handleDrop
        }
      >

        <div className="upload-icon">
          ↑
        </div>

        <div className="upload-title">
          {uploading
            ? "Uploading & replicating..."
            : "Drop your file here"}
        </div>

        <div className="upload-description">
          {uploading
            ? "RÉTROVA is creating four logical replicas."
            : "Drag and drop a file here, or browse your computer."}
        </div>

        {!uploading && (

          <button
            type="button"
            className="vault-btn vault-btn-primary upload-button"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            Choose File
          </button>

        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={
            handleInputChange
          }
        />

        {uploading && (

          <div className="upload-progress-wrap">

            <div className="progress-header">

              <span>
                Uploading
              </span>

              <strong>
                {uploadProgress}%
              </strong>

            </div>

            <div className="progress-track">

              <div
                className="progress-fill"
                style={{
                  width:
                    `${uploadProgress}%`,
                }}
              />

            </div>

            <div className="upload-progress-label">
              Replicating to node1 · node2 · node3 · node4
            </div>

          </div>

        )}

      </div>

    </section>
  );

  /* =====================================================
     FILE CARD
  ===================================================== */

  const FileCard = ({
    file,
  }) => {

    const progress =
      downloadProgress[
        file.fileId
      ];

    const replicas =
      file.replicas
        ? Object.values(
            file.replicas
          )
        : [];

    const healthy =
      replicas.filter(
        (replica) =>
          replica.status ===
          "HEALTHY"
      ).length;

    return (

      <article className="user-file-card vault-glass">

        <div className="user-file-main">

          <div className="user-file-icon">
            ◇
          </div>

          <div className="user-file-details">

            <div className="user-file-name">
              {file.fileName}
            </div>

            <div className="user-file-meta">

              <span>
                {formatSize(
                  file.size
                )}
              </span>

              <span className="meta-separator">
                ·
              </span>

              <span>
                {file.replicaCount ||
                  4} replicas
              </span>

              <span className="meta-separator">
                ·
              </span>

              <span>
                {healthy}/
                {replicas.length || 4} healthy
              </span>

            </div>

          </div>

          <Status
            status={
              file.status ||
              "HEALTHY"
            }
          />

        </div>

        {/* CHECKSUM */}

        <div className="user-file-checksum">

          <span>
            SHA-256
          </span>

          <code>
            {file.checksum
              ? `${file.checksum.slice(
                  0,
                  24
                )}...`
              : "Unavailable"}
          </code>

        </div>

        {/* DOWNLOAD */}

        <div className="user-file-actions">

          {progress !== undefined ? (

            <div className="download-progress">

              <div className="progress-header">

                <span>
                  Downloading
                </span>

                <strong>
                  {progress}%
                </strong>

              </div>

              <div className="progress-track">

                <div
                  className="progress-fill"
                  style={{
                    width:
                      `${progress}%`,
                  }}
                />

              </div>

            </div>

          ) : (

            <button
              type="button"
              className="vault-btn vault-btn-primary"
              onClick={() =>
                downloadFile(file)
              }
            >
              ↓ Download
            </button>

          )}

        </div>

      </article>
    );
  };

  /* =====================================================
     FILES
  ===================================================== */

  const FilesSection = () => (

    <section className="section user-files-section">

      <div className="section-header">

        <div>

          <div className="section-title">
            Your Files
          </div>

          <div className="section-description">
            Files stored with four logical replicas.
          </div>

        </div>

        <span className="status status-healthy">

          <span className="status-dot" />

          {files.length}{" "}
          {files.length === 1
            ? "File"
            : "Files"}

        </span>

      </div>

      {loading ? (

        <div className="empty-state vault-glass">

          <div className="empty-icon">
            ◌
          </div>

          <h3>
            Loading your files...
          </h3>

        </div>

      ) : files.length === 0 ? (

        <div className="empty-state vault-glass">

          <div className="empty-icon">
            ◇
          </div>

          <h3>
            No files yet
          </h3>

          <p>
            Upload your first file to create
            four protected replicas.
          </p>

        </div>

      ) : (

        <div className="user-files-grid">

          {files.map((file) => (

            <FileCard
              key={file.fileId}
              file={file}
            />

          ))}

        </div>

      )}

    </section>
  );

  /* =====================================================
     MAIN
  ===================================================== */

  return (

    <div className="vault-page page-enter">

      <div className="vault-container">

        <Header />

        {/* HERO */}

        <section className="vault-hero vault-glass">

          <div className="vault-eyebrow">
            Secure Distributed Storage
          </div>

          <h1>
            Your files,
            <br />
            safely replicated.
          </h1>

          <p>
            Upload once. RÉTROVA creates four
            logical replicas, verifies their
            integrity and keeps your data available.
          </p>

        </section>

        {/* STATS */}

        <section className="stats-grid">

          <div className="stat-card vault-glass">

            <div className="stat-label">
              Files
            </div>

            <div className="stat-value">
              {files.length}
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
                totalStorage
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
              {healthyReplicas}/
              {totalReplicas}
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
              {health}%
            </div>

            <div className="stat-note">
              Replica integrity
            </div>

          </div>

        </section>

        {/* UPLOAD */}

        <UploadArea />

        {/* FILES */}

        <FilesSection />

      </div>

      {/* MESSAGE */}

      {message && (

        <div
          className={`user-toast ${
            messageType === "error"
              ? "toast-error"
              : "toast-success"
          }`}
        >

          <span className="toast-dot" />

          {message}

        </div>

      )}

      {/* THEME */}

      <button
        type="button"
        className="theme-switcher"
        onClick={toggleTheme}
        title="Change theme"
      >
        {dark ? "☀" : "◐"}
      </button>

    </div>
  );
}