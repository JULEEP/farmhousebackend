import express from "express";
import {
  getPendingApplications,
  getApplicationDetails,
  reviewVendorApplication,
  getAllVendors,
  deleteVendor
} from "../controllers/adminController.js";

const router = express.Router();

// ✅ Add this middleware to set req.user for all admin routes
router.use((req, res, next) => {
  req.user = { id: "admin", role: "admin" }; // Set default admin user
  next();
});

// Routes
router.get('/vendor/applications/pending', getPendingApplications);
router.get('/vendor/application/:applicationId', getApplicationDetails);
router.put('/vendor/application/:applicationId/review', reviewVendorApplication);
router.get('/allvendor', getAllVendors);
router.delete('/deletevendor/:id', deleteVendor);


export default router;