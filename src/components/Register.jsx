import { useState } from "react";

import { createUserWithEmailAndPassword } from "firebase/auth";

import { doc, setDoc } from "firebase/firestore";

import { TextField, Button, Paper, Typography } from "@mui/material";

import { auth, db } from "../firebase/firebase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;

      // create user document
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        createdAt: new Date(),
      });

      alert("Account created!");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Paper sx={{ p: 4, width: 350 }}>
      <Typography variant="h5">Register</Typography>

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

      <Button variant="contained" fullWidth onClick={handleRegister}>
        Register
      </Button>
    </Paper>
  );
}
