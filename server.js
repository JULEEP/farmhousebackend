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
      const secret = 'vihari@25';
      const signature = req.headers["x-razorpay-signature"];

      // verify signature
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) return res.status(400).send("Invalid signature");

      const event = JSON.parse(req.body.toString());

      if (event.event === "payment.captured") {
        const payment = event.payload.payment.entity;

        const booking = await Booking.findOne({
          razorpayOrderId: payment.order_id
        });

        if (!booking) return res.status(404).send("Booking not found");

        // Calculate remaining amount and status
        const advancePaid = payment.amount / 100; // Razorpay amount in paise
        const totalAmount = booking.totalAmount;
        const remaining = totalAmount - advancePaid;

        let paymentStatus = "pending";
        let completePayment = false;

        if (remaining <= 0) {
          paymentStatus = "paid";
          completePayment = true;
        } else if (advancePaid > 0) {
          paymentStatus = "partial";
        }

        // Update booking
        booking.transactionId = payment.id;
        booking.razorpayPaymentId = payment.id;
        booking.advancePayment = advancePaid;
        booking.remainingAmount = remaining;
        booking.completePayment = completePayment;
        booking.paymentStatus = paymentStatus;
        booking.updatedAt = new Date();

        await booking.save();

        console.log("✅ Webhook updated booking:", booking._id);
      }

      res.json({ status: "ok" });

    } catch (err) {
      console.error("❌ webhook error:", err);
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