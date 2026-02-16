import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import Shop from "../models/shop.model.js";
import { User } from "../models/user.model.js";

dotenv.config();

const seedVendors = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB");

    // Create sample vendor users
    const vendorUsers = [
      {
        name: "John's Electronics",
        email: "john@electronics.com",
        password: await bcrypt.hash("vendor123", 10),
        role: "user",
        isEmailVerified: true,
      },
      {
        name: "Fashion Hub",
        email: "fashion@hub.com",
        password: await bcrypt.hash("vendor123", 10),
        role: "user",
        isEmailVerified: true,
      },
      {
        name: "Home Essentials",
        email: "home@essentials.com",
        password: await bcrypt.hash("vendor123", 10),
        role: "user",
        isEmailVerified: true,
      },
    ];

    // Create users
    const createdUsers = [];
    for (const userData of vendorUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        createdUsers.push(existingUser);
        console.log(`User ${userData.email} already exists`);
      } else {
        const user = await User.create(userData);
        createdUsers.push(user);
        console.log(`Created user: ${userData.email}`);
      }
    }

    // Sample shops
    const sampleShops = [
      {
        name: "John's Electronics Store",
        description: "Premium electronics and gadgets. We offer the latest smartphones, laptops, tablets, and accessories at competitive prices.",
        email: "contact@johnelectronics.com",
        phone: "+1 (555) 123-4567",
        website: "https://johnelectronics.com",
        owner: createdUsers[0]._id,
        businessType: "company",
        businessRegistrationNumber: "ELC-2024-001",
        taxId: "12-3456789",
        categories: ["Electronics", "Gadgets", "Accessories"],
        address: {
          streetAddress: "123 Tech Street",
          city: "San Francisco",
          state: "CA",
          zipCode: "94102",
          country: "USA",
        },
        bankDetails: {
          accountHolderName: "John Electronics LLC",
          bankName: "Bank of America",
          accountNumber: "123456789012",
          routingNumber: "021000089",
        },
        socialMedia: {
          facebook: "https://facebook.com/johnelectronics",
          instagram: "https://instagram.com/johnelectronics",
          twitter: "https://twitter.com/johnelectronics",
        },
        status: "pending",
        commissionRate: 10,
      },
      {
        name: "Fashion Hub Boutique",
        description: "Trendy fashion for everyone. From casual wear to formal attire, we have the latest styles at affordable prices.",
        email: "hello@fashionhub.com",
        phone: "+1 (555) 234-5678",
        website: "https://fashionhub.com",
        owner: createdUsers[1]._id,
        businessType: "partnership",
        businessRegistrationNumber: "FHB-2024-002",
        taxId: "98-7654321",
        categories: ["Fashion", "Clothing", "Accessories"],
        address: {
          streetAddress: "456 Fashion Ave",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
        },
        bankDetails: {
          accountHolderName: "Fashion Hub Partners",
          bankName: "Chase Bank",
          accountNumber: "987654321098",
          routingNumber: "021000021",
        },
        socialMedia: {
          facebook: "https://facebook.com/fashionhub",
          instagram: "https://instagram.com/fashionhub",
        },
        status: "approved",
        isActive: true,
        commissionRate: 12,
      },
      {
        name: "Home Essentials Co",
        description: "Everything for your home. Quality furniture, decor, and household items to make your house a home.",
        email: "support@homeessentials.com",
        phone: "+1 (555) 345-6789",
        owner: createdUsers[2]._id,
        businessType: "individual",
        categories: ["Home", "Furniture", "Decor"],
        address: {
          streetAddress: "789 Home Lane",
          city: "Los Angeles",
          state: "CA",
          zipCode: "90001",
          country: "USA",
        },
        status: "pending",
        commissionRate: 8,
      },
    ];

    // Create or update shops
    for (const shopData of sampleShops) {
      const existingShop = await Shop.findOne({ owner: shopData.owner });
      if (existingShop) {
        console.log(`Shop for ${shopData.email} already exists`);
      } else {
        const shop = await Shop.create(shopData);
        console.log(`Created shop: ${shop.name} (Status: ${shop.status})`);
        
        // If approved, update owner role to vendor
        if (shop.status === "approved") {
          await User.findByIdAndUpdate(shop.owner, { role: "vendor" });
        }
      }
    }

    console.log("\n✅ Vendors seeded successfully!");
    console.log("\nSample vendor accounts:");
    console.log("- john@electronics.com / vendor123 (Pending shop)");
    console.log("- fashion@hub.com / vendor123 (Approved shop)");
    console.log("- home@essentials.com / vendor123 (Pending shop)");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding vendors:", error);
    process.exit(1);
  }
};

seedVendors();
