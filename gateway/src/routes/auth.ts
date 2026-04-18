import { Router } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret";
const DJANGO_URL = process.env.DJANGO_URL ?? "http://django:8000";

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  try {
    // Delegate auth to Django
    const { data } = await axios.post(`${DJANGO_URL}/api/users/login/`, { email, password });

    const token = jwt.sign(
      { userId: data.user.id, email: data.user.email },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({ token, user: data.user });
  } catch (err: any) {
    const status = err.response?.status ?? 500;
    const message = err.response?.data?.detail ?? "Login failed";
    res.status(status).json({ error: message });
  }
});

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  try {
    const { data } = await axios.post(`${DJANGO_URL}/api/users/register/`, req.body);

    const token = jwt.sign(
      { userId: data.user.id, email: data.user.email },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({ token, user: data.user });
  } catch (err: any) {
    const status = err.response?.status ?? 500;
    res.status(status).json({ error: err.response?.data ?? "Registration failed" });
  }
});

// POST /api/auth/logout  (client discards token — stateless)
authRouter.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});
