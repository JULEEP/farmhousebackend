import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  farmhouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Farmhouse",
  },
  transactionId: {
    type: String,
  },
  verificationId: {
    type: String,
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  
  bookingDetails: {
    date: { type: Date, },
    label: { type: String,  },
    timing: { type: String,  },
    checkIn: { type: Date,  },
    checkOut: { type: Date, }
  },
  
  slotPrice: { type: Number,  },
  cleaningFee: { type: Number, default: 0,  },
  serviceFee: { type: Number, default: 0,  },
  totalAmount: { type: Number,  },

   // Partial payment support
  advancePayment: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  completePayment: { type: Boolean, default: false },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'failed', 'cancelled', 'completed'],
    default: 'pending'
  },
  
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending"
  },
  
  // paymentStatus: {
  //   type: String,
  //   enum: ["pending", "completed", "failed", "refunded"],
  //   default: "completed"
  // },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

bookingSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

export const Booking = mongoose.model("Booking", bookingSchema);