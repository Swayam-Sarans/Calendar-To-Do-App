import { useState, useEffect } from "react";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

import { useAuth } from "../context/AuthContext.jsx";

import { TextField, Button, Paper, Typography } from "@mui/material";

import { auth } from "../firebase/firebase.js";

export default function Login({ setLoginOpen }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  // Google Provider
  const provider = new GoogleAuthProvider();

  // Email/Password Login
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);

      setLoginOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  // Email/Password Signup
  const handleSignup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);

      setLoginOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  // Google Login
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);

      setLoginOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Paper
      sx={{
        p: 4,
        width: 350,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Typography variant="h5" textAlign="center" fontWeight="bold">
        {isSignup ? "Create Account" : "Login"}
      </Typography>

      <TextField
        fullWidth
        label="Email"
        margin="normal"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <TextField
        fullWidth
        label="Password"
        type="password"
        margin="normal"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button
        variant="contained"
        fullWidth
        onClick={isSignup ? handleSignup : handleLogin}
      >
        {isSignup ? "Sign Up" : "Login"}
      </Button>

      <Button
        variant="outlined"
        fullWidth
        sx={{ mt: 2 }}
        onClick={handleGoogleLogin}
      >
        Continue with Google
      </Button>

      <Button fullWidth sx={{ mt: 1 }} onClick={() => setIsSignup(!isSignup)}>
        {isSignup
          ? "Already have an account? Login"
          : "New user? Create account"}
      </Button>
    </Paper>
  );
}
