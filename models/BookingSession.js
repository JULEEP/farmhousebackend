// models/BookingSession.js
import mongoose from "mongoose";

const bookingSessionSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
  },
  farmhouseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Farmhouse",
  },
  slotId: { 
    type: mongoose.Schema.Types.ObjectId, 
  },
  date: { 
    type: Date, 
  },
  label: { 
    type: String, 
  },
  timing: { 
    type: String, 
  },
  price: { 
    type: Number, 
  },
  expiresAt: { 
    type: Date, 
    index: { expires: '30m' } // Auto delete after 30 minutes
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const BookingSession = mongoose.model("BookingSession", bookingSessionSchema);