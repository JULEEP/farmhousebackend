import { Farmhouse } from "../models/farmhouseModel.js";
import { sendApplicationEmail } from "../services/emailService.js";
import { Vendor } from "../models/vendor.js";

export const reviewVendorApplication = async (req, res) => {
  try {
    console.log("=== Review Application ===");
    console.log("Application ID:", req.params.applicationId);
    console.log("Action:", req.body.action);
    
    const { applicationId } = req.params;
    const { action, adminNotes, rejectedReason } = req.body;
    
    // Find the application
    const application = await Vendor.findOne({ applicationId });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }
    
    console.log("Application found:", application.submittedData.name);
    console.log("Current status:", application.status);
    
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application already ${application.status}`
      });
    }
    
    // Handle REJECTION
    if (action === 'reject') {
      application.status = 'rejected';
      application.rejectedReason = rejectedReason;
      application.adminNotes = adminNotes;
      application.reviewedAt = new Date();
      application.reviewedBy = "admin"; // ✅ Now works as String
      
      await application.save();
      
      console.log("Application rejected");
      
      // Try to send email
      try {
        await sendApplicationEmail({
          to: application.email,
          applicationId: application.applicationId,
          farmhouseName: application.submittedData.name,
          status: 'rejected',
          reason: rejectedReason
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError.message);
      }
      
      return res.json({
        success: true,
        message: "Application rejected",
        status: 'rejected'
      });
    }
    
    // Handle APPROVAL
    if (action === 'approve') {
      console.log("Creating farmhouse...");
      
      // Create Farmhouse document
      const farmhouse = await Farmhouse.create({
        name: application.submittedData.name,
        images: application.submittedData.images || [],
        address: application.submittedData.address,
        description: application.submittedData.description || "",
        amenities: application.submittedData.amenities || [],
        price: application.submittedData.price,
        rating: application.submittedData.rating || 0,
        feedbackSummary: application.submittedData.feedbackSummary || "",
        bookingFor: application.submittedData.bookingFor || "",
        timePrices: application.submittedData.timePrices || [],
        active: true,
        location: {
          type: "Point",
          coordinates: [
            Number(application.submittedData.lng),
            Number(application.submittedData.lat)
          ]
        }
      });
      
      console.log("Farmhouse created with ID:", farmhouse._id);
      
      // Generate vendor credentials
      const cleanName = farmhouse.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const firstThreeLetters = cleanName.substring(0, 3);
      const farmhouseIdStr = farmhouse._id.toString();
      const idPrefix = farmhouseIdStr.substring(0, 6);
      const vendorName = `${firstThreeLetters}${idPrefix}`;
      const password = vendorName;
      
      console.log("Generated credentials:", { vendorName, password });
      
      // Update vendor document
      application.name = vendorName;
      application.password = password;
      application.farmhouseId = farmhouse._id;
      application.status = 'approved';
      application.adminNotes = adminNotes;
      application.reviewedAt = new Date();
      application.reviewedBy = "admin"; // ✅ Now works as String
      
      await application.save();
      
      console.log("Vendor application approved and saved");
      
      // Try to send email
      try {
        await sendApplicationEmail({
          to: application.email,
          applicationId: application.applicationId,
          farmhouseName: farmhouse.name,
          status: 'approved',
          credentials: { vendorName, password }
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError.message);
      }
      
      return res.json({
        success: true,
        message: "Application approved",
        farmhouseId: farmhouse._id,
        vendorCredentials: { vendorName, password }
      });
    }
    
    return res.status(400).json({
      success: false,
      message: "Invalid action. Use 'approve' or 'reject'"
    });
    
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// Get all pending applications
export const getPendingApplications = async (req, res) => {
  try {
    const applications = await Vendor.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .select('applicationId email submittedData.name submittedData.price createdAt');
    
    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get application details for review
export const getApplicationDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await Vendor.findOne({ applicationId });
    
    if (!application) {
      return res.status(404).json({ 
        success: false,
        message: "Application not found" 
      });
    }
    
    res.json({
      success: true,
      application: {
        applicationId: application.applicationId,
        email: application.email,
        status: application.status,
        submittedData: application.submittedData,
        createdAt: application.createdAt
      }
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
};


// ============================================
// GET ALL VENDORS (SIMPLE - NO FILTER, NO PAGINATION)
// ============================================
// ============================================
// GET ALL VENDORS WITH FARMHOUSE DETAILS
// ============================================
export const getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find()
      .populate({
        path: "farmhouseId",
        select: "name images address description price"
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors
    });

  } catch (err) {
    console.error("Get vendors error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
      error: err.message
    });
  }
};


export const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the application first
    const application = await Vendor.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Optional: If application was approved and has a farmhouseId, you might want to delete that farmhouse too
    if (application.farmhouseId) {
      await Farmhouse.findByIdAndDelete(application.farmhouseId);
    }

    // Delete the application
    await Vendor.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Application deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting application',
      error: error.message
    });
  }
};
