import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";

const adminUser = {
  name: "admin",
  email: "admin@gmail.com",
  password: "admin123456",
  role: "admin",
  isEmailVerified: true,
};

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(ENV.DB_URL);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminUser.email });
    
    if (existingAdmin) {
      if (existingAdmin.role !== "admin") {
        await User.updateOne(
          { email: adminUser.email },
          { $set: { role: "admin", name: existingAdmin.name || "admin" } }
        );
        console.log("✅ Updated existing user to admin role");
      } else {
        console.log("⚠️  Admin user already exists");
      }
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: admin`);
    } else {
      const admin = await User.create(adminUser);
      console.log("✅ Successfully created admin user");
      console.log(`   Name: ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
    }

    // Close connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding admin:", error.message);
    process.exit(1);
  }
};

seedAdmin();
