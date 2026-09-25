import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import api from "../services/api";

export default function AdminRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("unauthenticated");
        return;
      }

      try {
        const response = await api.get("/auth/me");

        if (response.data.user.role === "admin") {
          setStatus("admin");
        } else {
          setStatus("user");
        }
      } catch {
        setStatus("unauthenticated");
      }
    });

    return unsubscribe;
  }, []);

  if (status === "checking") {
    return <p>Checking authorization...</p>;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/" replace />;
  }

  if (status === "user") {
    return <Navigate to="/user/dashboard" replace />;
  }

  return children;
}