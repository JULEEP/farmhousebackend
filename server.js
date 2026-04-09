import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import dns from "dns"; // ✅ ADD THIS
import authRoutes from "./routes/authRoutes.js";
import farmhouse from "./routes/farmhouseRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import feeConfigRoutes from "./routes/feeConfigRoutes.js";
import vendor from "./routes/vendor.js";
import dotenv from "dotenv";
import crypto from "crypto";
import { Booking } from "./models/bookingModel.js";

dotenv.config(); // MUST be first

// ==================== DNS FIX ====================
// Force IPv4 first
dns.setDefaultResultOrder('ipv4first');

// Set custom DNS servers
dns.setServers([
  '8.8.8.8',       // Google
  '8.8.4.4',       // Google secondary
  '1.1.1.1',       // Cloudflare
  '208.67.222.222' // OpenDNS
]);

console.log('🌐 DNS Configuration:');
console.log('   - Default order: ipv4first');
console.log('   - DNS Servers:', dns.getServers());
// =================================================

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Debug
console.log("JWT_SECRET loaded:", process.env.JWT_SECRET ? "✅ Yes" : "❌ No");


app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const secret = "vihari@25";
      const signature = req.headers["x-razorpay-signature"];

      // Postman testing ke liye bypass signature
      let isValid = true;

      // Uncomment for real Razorpay verification
      /*
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) return res.status(400).send("Invalid signature");
      */

      let event;
      if (Buffer.isBuffer(req.body)) event = JSON.parse(req.body.toString());
      else event = req.body;

      console.log("📢 EVENT:", event.event);

      if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;

        // Booking ID from notes
        const bookingId = payment.notes?.bookingId;
        if (!bookingId) return res.status(400).send("BookingId not found");

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).send("Booking not found");

        const paymentAmount = payment.amount / 100; // paise → rupees
        const totalAmount = booking.totalAmount;

        // ---------------- PAYMENT CALCULATION ----------------
        let advancePayment = (booking.advancePayment || 0) + paymentAmount;
        let remainingAmount = totalAmount - advancePayment;

        let paymentStatus = "partial"; // default partial
        if (remainingAmount <= 0) paymentStatus = "paid";

        // ---------------- UPDATE BOOKING ----------------
        booking.razorpayPaymentId = payment.id;
        booking.transactionId = payment.id;
        booking.advancePayment = advancePayment;
        booking.remainingAmount = remainingAmount < 0 ? 0 : remainingAmount;
        booking.paymentStatus = paymentStatus;
        booking.status = "confirmed";      // hamesha confirmed
        booking.completePayment = remainingAmount <= 0;
        booking.updatedAt = new Date();

        await booking.save();
        console.log("✅ Booking updated:", booking._id, "Status:", booking.status, "PaymentStatus:", booking.paymentStatus);
      }

      res.json({ status: "ok" });
    } catch (err) {
      console.error("❌ Webhook Error:", err);
      res.status(500).send("Webhook error");
    }
  }
);
// Routes
app.use("/api/auth", authRoutes);
app.use("/api", farmhouse);
app.use("/api/cart", cartRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/fees", feeConfigRoutes);
app.use("/api/vendor", vendor);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => console.error("Mongo Error:", err.message));

// Default route
app.get("/", (req, res) => {
  res.send("Server Running Successfully 🚀");
});

// Server
const PORT = process.env.PORT || 5124;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});