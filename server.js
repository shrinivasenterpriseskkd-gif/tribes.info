import "dotenv/config";
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Razorpay from "razorpay";
const app = express();
const port = process.env.PORT || 5500;
const root = path.dirname(fileURLToPath(import.meta.url));
const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) : null;
const adminSessions = new Map();
const loginAttempts = new Map();
const adminSessionDuration = 8 * 60 * 60 * 1000;
const loginAttemptWindow = 15 * 60 * 1000;
const maxLoginAttempts = 5;
const adminAllowedOrigin = process.env.ADMIN_ALLOWED_ORIGIN || "";

if (!razorpay) console.warn("Razorpay keys are missing. Add them to .env before checkout.");
app.use(express.json());

const secureCookie = process.env.NODE_ENV === "production";
const cookieSameSite = adminAllowedOrigin ? "None" : "Strict";
const readAdminSession = request => {
  const cookieHeader = request.headers.cookie || "";
  const token = cookieHeader.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith("tribes_admin_session="))?.slice("tribes_admin_session=".length);
  if (!token) return false;
  const expiresAt = adminSessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
};
const adminCookie = (token, maxAge) => `tribes_admin_session=${token}; Path=/; HttpOnly; SameSite=${cookieSameSite}; Max-Age=${maxAge}${secureCookie ? "; Secure" : ""}`;
const adminPageProtection = (request, response, next) => {
  if (request.path === "/login.html") return next();
  if (readAdminSession(request)) return next();
  if (request.accepts("html")) return response.redirect(302, "/admin/login.html");
  return response.status(401).send("Admin sign-in required.");
};
app.use("/admin", adminPageProtection);

app.use("/api/admin", (request, response, next) => {
  const origin = request.get("origin");
  if (origin && adminAllowedOrigin && origin === adminAllowedOrigin) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Access-Control-Allow-Credentials", "true");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.vary("Origin");
  } else if (origin && adminAllowedOrigin && origin !== adminAllowedOrigin) {
    return response.status(403).json({ error: "This origin is not allowed to access Admin sign-in." });
  }
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

const safeEqual = (provided, expected) => {
  if (typeof provided !== "string" || Buffer.byteLength(provided) !== Buffer.byteLength(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
};

app.post("/api/admin/login", (request, response) => {
  const loginId = process.env.ADMIN_LOGIN_ID;
  const password = process.env.ADMIN_PASSWORD;
  if (!loginId || !password) return response.status(503).json({ error: "Admin sign-in is not configured. Set ADMIN_LOGIN_ID and ADMIN_PASSWORD on the server." });

  const clientId = request.ip;
  const now = Date.now();
  const currentAttempt = loginAttempts.get(clientId);
  const attempt = currentAttempt && currentAttempt.expiresAt > now
    ? currentAttempt
    : { count: 0, expiresAt: now + loginAttemptWindow };
  if (attempt.count >= maxLoginAttempts) {
    response.set("Retry-After", String(Math.ceil((attempt.expiresAt - now) / 1000)));
    return response.status(429).json({ error: "Too many sign-in attempts. Wait and try again." });
  }

  const isValidId = safeEqual(request.body?.loginId, loginId);
  const isValidPassword = safeEqual(request.body?.password, password);
  const isValid = isValidId && isValidPassword;
  if (!isValid) {
    attempt.count += 1;
    loginAttempts.set(clientId, attempt);
    return response.status(401).json({ error: "Admin ID or password is incorrect." });
  }

  loginAttempts.delete(clientId);
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, now + adminSessionDuration);
  response.set("Set-Cookie", adminCookie(token, adminSessionDuration / 1000));
  response.json({ authenticated: true });
});

app.get("/api/admin/session", (request, response) => {
  response.json({ authenticated: readAdminSession(request) });
});

app.post("/api/admin/logout", (request, response) => {
  const cookieHeader = request.headers.cookie || "";
  const token = cookieHeader.split(";").map(cookie => cookie.trim()).find(cookie => cookie.startsWith("tribes_admin_session="))?.slice("tribes_admin_session=".length);
  if (token) adminSessions.delete(token);
  response.set("Set-Cookie", adminCookie("", 0));
  response.json({ authenticated: false });
});

app.use(express.static(root));

app.post("/api/orders", async (request, response) => {
  try {
    if (!razorpay) return response.status(503).json({ error: "Razorpay is not configured. Add keys to .env." });
    const items = Array.isArray(request.body.items) ? request.body.items : [];
    if (!items.length) return response.status(400).json({ error: "Cart is empty." });
    const amount = Number(request.body.amount);
    if (!Number.isInteger(amount) || amount < 100) return response.status(400).json({ error: "Order amount must be at least INR 1." });
    const order = await razorpay.orders.create({ amount, currency: "INR", receipt: `tribes_${Date.now()}`, notes: { itemCount: String(items.length) } });
    response.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) { console.error(error); response.status(500).json({ error: "Unable to create payment order." }); }
});

app.post("/api/merchant-registration-order", async (request, response) => {
  try {
    if (!razorpay) return response.status(503).json({ error: "Razorpay is not configured. Add keys to .env." });
    const merchantId = String(request.body.merchantId || "").trim();
    if (!merchantId) return response.status(400).json({ error: "Merchant ID is required." });
    const order = await razorpay.orders.create({ amount: 100, currency: "INR", receipt: `tribes_donation_${Date.now()}`, notes: { purpose: "merchant_registration_donation", merchantId } });
    response.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) { console.error(error); response.status(500).json({ error: "Unable to create donation order." }); }
});

app.post("/api/payments/verify", (request, response) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = request.body;
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  if (!signature || Buffer.byteLength(expected) !== Buffer.byteLength(signature) || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return response.status(400).json({ verified: false });
  response.json({ verified: true });
});

app.listen(port, () => console.log(`Janjeevan.store running at http://localhost:${port}`));