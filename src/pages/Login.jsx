import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { auth } from "../services/firebase";
import api from "../services/api";

import "./Login.css";

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [stage, setStage] = useState("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  /* =====================================================
     INITIAL THEME
  ===================================================== */

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("vault-theme");

    const isDark = savedTheme === "dark";

    setDark(isDark);

    document.documentElement.dataset.theme =
      isDark ? "dark" : "light";
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
     DELAY
  ===================================================== */

  const wait = (milliseconds) =>
    new Promise((resolve) =>
      setTimeout(resolve, milliseconds)
    );

  /* =====================================================
     CLEAR MESSAGES
  ===================================================== */

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  /* =====================================================
     SWITCH LOGIN / REGISTER
  ===================================================== */

  const switchMode = (newMode) => {
    if (loading) return;

    setMode(newMode);

    setEmail("");
    setPassword("");
    setConfirmPassword("");

    setStage("idle");

    clearMessages();
  };

  /* =====================================================
     LOGIN
  ===================================================== */

  const handleLogin = async (event) => {
    event.preventDefault();

    if (loading) return;

    clearMessages();

    if (!email.trim()) {
      setError("Enter your email address.");
      setStage("error");

      setTimeout(() => {
        setStage("idle");
      }, 850);

      return;
    }

    if (!password) {
      setError("Enter your password.");
      setStage("error");

      setTimeout(() => {
        setStage("idle");
      }, 850);

      return;
    }

    try {
      setLoading(true);

      /*
       * ----------------------------------------
       * CHECKING CREDENTIALS
       * ----------------------------------------
       */

      setStage("checking");

      /*
       * REAL FIREBASE LOGIN
       */

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      /*
       * ----------------------------------------
       * SYNC USER
       * ----------------------------------------
       */

      await api.post("/auth/sync-user");

      /*
       * ----------------------------------------
       * GET ROLE
       * ----------------------------------------
       */

      const response =
        await api.get("/auth/me");

      const role =
        response.data?.user?.role ||
        response.data?.role ||
        "user";

      /*
       * ----------------------------------------
       * START LOCK ANIMATION
       * ----------------------------------------
       */

      setStage("unlocking");

      await wait(1200);

      /*
       * LOCK FULLY OPEN
       */

      setStage("open");

      await wait(700);

      /*
       * ----------------------------------------
       * SCROLL LOGIN SCREEN AWAY
       * ----------------------------------------
       */

      setStage("exit");

      await wait(900);

      /*
       * ----------------------------------------
       * DASHBOARD
       * ----------------------------------------
       */

      if (role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/user/dashboard");
      }

    } catch (err) {
      console.error(
        "RÉTROVA login failed:",
        err
      );

      /*
       * IMPORTANT:
       * Wrong credentials NEVER unlock.
       */

      setStage("error");

      if (
        err?.code ===
          "auth/invalid-credential" ||
        err?.code ===
          "auth/wrong-password" ||
        err?.code ===
          "auth/user-not-found"
      ) {
        setError(
          "Incorrect email or password."
        );
      } else {
        setError(
          err?.response?.data?.message ||
          "Unable to unlock RÉTROVA."
        );
      }

      setTimeout(() => {
        setStage("idle");
      }, 850);

    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     REGISTER
  ===================================================== */

  const handleRegister = async (event) => {
    event.preventDefault();

    if (loading) return;

    clearMessages();

    /* Email */

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    /* Password */

    if (!password) {
      setError("Create a password.");
      return;
    }

    /* Password length */

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    /* Confirm password */

    if (!confirmPassword) {
      setError(
        "Confirm your password."
      );
      return;
    }

    /* Password match */

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setLoading(true);

      setStage("registering");

      /*
       * ----------------------------------------
       * CREATE FIREBASE ACCOUNT
       * ----------------------------------------
       */

      await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      /*
       * ----------------------------------------
       * CREATE FIRESTORE USER PROFILE
       *
       * Backend automatically gives new users
       * role = "user".
       * ----------------------------------------
       */

      await api.post("/auth/sync-user");

      /*
       * ----------------------------------------
       * SIGN OUT
       *
       * We want the user to explicitly log in
       * after creating the account.
       * ----------------------------------------
       */

      await signOut(auth);

      /*
       * ----------------------------------------
       * RETURN TO LOGIN
       * ----------------------------------------
       */

      setMode("login");

      setPassword("");
      setConfirmPassword("");

      setStage("registered");

      setSuccess(
        "Account created successfully. You can now sign in."
      );

    } catch (err) {
      console.error(
        "RÉTROVA registration failed:",
        err
      );

      if (
        err?.code ===
        "auth/email-already-in-use"
      ) {
        setError(
          "An account with this email already exists."
        );
      } else if (
        err?.code ===
        "auth/invalid-email"
      ) {
        setError(
          "Enter a valid email address."
        );
      } else if (
        err?.code ===
        "auth/weak-password"
      ) {
        setError(
          "Password is too weak."
        );
      } else {
        setError(
          err?.response?.data?.message ||
          "Unable to create account."
        );
      }

      setStage("idle");

    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     PASSWORD DOTS
  ===================================================== */

  const passwordDots = Math.min(
    password.length,
    12
  );

  /* =====================================================
     LOGIN MODE
  ===================================================== */

  const isLogin = mode === "login";

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <div
      className={`vault-login-page vault-stage-${stage} ${
        isLogin
          ? "vault-mode-login"
          : "vault-mode-register"
      }`}
    >

      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="vault-bg-orb vault-bg-orb-1" />
      <div className="vault-bg-orb vault-bg-orb-2" />
      <div className="vault-bg-orb vault-bg-orb-3" />

      {/* =================================================
          MAIN LOGIN SCENE
      ================================================= */}

      <main className="vault-login-scene">

        <section className="vault-login-card">

          {/* =================================================
              LOCK
          ================================================= */}

          <div
            className={`vault-lock-area ${
              !isLogin
                ? "vault-register-lock"
                : ""
            }`}
          >

            <div className="vault-lock-glow" />

            {/* Particles only relevant to login */}
            {isLogin && (
              <div className="vault-particles">

                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />

              </div>
            )}

            <div className="vault-lock">

              <div className="vault-lock-shackle" />

              <div className="vault-lock-body">

                <div className="vault-keyhole">

                  <div className="vault-keyhole-circle" />

                  <div className="vault-keyhole-stem" />

                </div>

              </div>

            </div>

          </div>

          {/* =================================================
              BRAND
          ================================================= */}

          <div className="vault-login-heading">

            <div className="vault-login-eyebrow">
              SECURE STORAGE
            </div>

            <h1>
              RÉTROVA
            </h1>

            <p>
              {isLogin
                ? "Your files. Safely replicated."
                : "Create your secure storage account."}
            </p>

          </div>

          {/* =================================================
              FORM
          ================================================= */}

          <form
            className="vault-login-form"
            onSubmit={
              isLogin
                ? handleLogin
                : handleRegister
            }
          >

            {/* EMAIL */}

            <div className="vault-field">

              <label htmlFor="vault-email">
                Email address
              </label>

              <div className="vault-input-wrapper">

                <span className="vault-input-icon">
                  @
                </span>

                <input
                  id="vault-email"
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  onChange={(event) => {

                    setEmail(
                      event.target.value
                    );

                    clearMessages();

                    if (stage === "error") {
                      setStage("idle");
                    }

                  }}
                />

              </div>

            </div>

            {/* PASSWORD */}

            <div className="vault-field">

              <label htmlFor="vault-password">
                Password
              </label>

              <div className="vault-input-wrapper">

                <span className="vault-input-icon password-icon">
                  •
                </span>

                <input
                  id="vault-password"
                  type="password"
                  value={password}
                  placeholder={
                    isLogin
                      ? "Enter your password"
                      : "Create a password"
                  }
                  autoComplete={
                    isLogin
                      ? "current-password"
                      : "new-password"
                  }
                  disabled={loading}
                  onChange={(event) => {

                    setPassword(
                      event.target.value
                    );

                    clearMessages();

                    if (stage === "error") {
                      setStage("idle");
                    }

                  }}
                />

              </div>

              {/* Password dots only on login */}

              {isLogin && (
                <div className="vault-password-dots">

                  {Array.from(
                    { length: 12 },
                    (_, index) => (
                      <span
                        key={index}
                        className={
                          index < passwordDots
                            ? "active"
                            : ""
                        }
                      />
                    )
                  )}

                </div>
              )}

            </div>

            {/* =================================================
                CONFIRM PASSWORD
            ================================================= */}

            {!isLogin && (

              <div className="vault-field">

                <label htmlFor="vault-confirm-password">
                  Confirm password
                </label>

                <div className="vault-input-wrapper">

                  <span className="vault-input-icon password-icon">
                    •
                  </span>

                  <input
                    id="vault-confirm-password"
                    type="password"
                    value={confirmPassword}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={loading}
                    onChange={(event) => {

                      setConfirmPassword(
                        event.target.value
                      );

                      clearMessages();

                    }}
                  />

                </div>

              </div>

            )}

            {/* =================================================
                SUCCESS
            ================================================= */}

            {success && (

              <div className="vault-login-success">

                <span className="vault-success-icon">
                  ✓
                </span>

                <span>
                  {success}
                </span>

              </div>

            )}

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

              <div className="vault-login-error">

                <span className="vault-error-icon">
                  !
                </span>

                <span>
                  {error}
                </span>

              </div>

            )}

            {/* =================================================
                BUTTON
            ================================================= */}

            <button
              type="submit"
              className="vault-login-button"
              disabled={loading}
            >

              <span className="vault-button-left">

                <span className="vault-button-lock">

                  {stage === "open"
                    ? "✓"
                    : isLogin
                    ? "●"
                    : "+"}

                </span>

                <span>

                  {isLogin
                    ? stage === "checking"
                      ? "Verifying..."
                      : stage === "unlocking"
                      ? "Unlocking RÉTROVA..."
                      : stage === "open"
                      ? "RÉTROVA Unlocked"
                      : "Unlock RÉTROVA"
                    : loading
                    ? "Creating Account..."
                    : "Create Account"}

                </span>

              </span>

              <span className="vault-button-arrow">
                →
              </span>

            </button>

          </form>

          {/* =================================================
              LOGIN / REGISTER SWITCH
          ================================================= */}

          <div className="vault-mode-switch">

            {isLogin ? (
              <>
                <span>
                  Don't have an account?
                </span>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    switchMode("register")
                  }
                >
                  Create account
                </button>
              </>
            ) : (
              <>
                <span>
                  Already have an account?
                </span>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    switchMode("login")
                  }
                >
                  Sign in
                </button>
              </>
            )}

          </div>

          {/* =================================================
              SECURITY FOOTER
          ================================================= */}

          <div className="vault-security-footer">

            <span className="vault-security-dot" />

            <span>
              Protected by Firebase Authentication
            </span>

          </div>

        </section>

      </main>

      {/* =================================================
          THEME BUTTON
      ================================================= */}

      <button
        type="button"
        className="vault-theme-button"
        onClick={toggleTheme}
        title="Change theme"
      >
        {dark ? "☀" : "◐"}
      </button>

    </div>
  );
}