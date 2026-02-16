import mongoose from "mongoose";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";

const adminUser = {
  name: "admin",
  email: "admin@gmail.com",
  password: "admin123456",
  role: "admin",
  isEmailVerified: true,
};

const products = [
  {
    name: "Wireless Bluetooth Headphones",
    description: "Premium over-ear headphones with active noise cancellation, 30-hour battery life, and premium sound quality.",
    price: 149.99,
    stock: 50,
    category: "Electronics",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500"],
    averageRating: 4.5,
    totalReviews: 128,
  },
  {
    name: "Smart Watch Series 5",
    description: "Advanced fitness tracking, heart rate monitor, GPS, and water-resistant design.",
    price: 299.99,
    stock: 35,
    category: "Electronics",
    images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500"],
    averageRating: 4.7,
    totalReviews: 256,
  },
  {
    name: "Leather Crossbody Bag",
    description: "Handcrafted genuine leather bag with adjustable strap and multiple compartments.",
    price: 89.99,
    stock: 25,
    category: "Fashion",
    images: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500"],
    averageRating: 4.3,
    totalReviews: 89,
  },
  {
    name: "Running Shoes Pro",
    description: "Lightweight running shoes with responsive cushioning and breathable mesh upper.",
    price: 129.99,
    stock: 40,
    category: "Sports",
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500"],
    averageRating: 4.6,
    totalReviews: 312,
  },
  {
    name: "Minimalist Desk Lamp",
    description: "Modern LED desk lamp with adjustable brightness and color temperature.",
    price: 59.99,
    stock: 60,
    category: "Home",
    images: ["https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500"],
    averageRating: 4.4,
    totalReviews: 156,
  },
  {
    name: "Organic Coffee Beans",
    description: "Premium single-origin Arabica coffee beans, freshly roasted.",
    price: 24.99,
    stock: 100,
    category: "Food",
    images: ["https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500"],
    averageRating: 4.8,
    totalReviews: 423,
  },
  {
    name: "Wireless Gaming Mouse",
    description: "High-precision gaming mouse with customizable RGB lighting and programmable buttons.",
    price: 79.99,
    stock: 45,
    category: "Electronics",
    images: ["https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500"],
    averageRating: 4.5,
    totalReviews: 289,
  },
  {
    name: "Yoga Mat Premium",
    description: "Extra thick eco-friendly yoga mat with non-slip surface and carrying strap.",
    price: 49.99,
    stock: 75,
    category: "Sports",
    images: ["https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500"],
    averageRating: 4.7,
    totalReviews: 178,
  },
];

const seedAll = async () => {
  try {
    await mongoose.connect(ENV.DB_URL);
    console.log("✅ Connected to MongoDB");

    // Drop problematic index if exists
    try {
      await mongoose.connection.collection("products").dropIndex("sku_1");
      console.log("🗑️  Dropped sku index");
    } catch (e) {
      // Index doesn't exist, continue
    }

    // Clear and seed products
    await Product.deleteMany({});
    console.log("🗑️  Cleared existing products");

    await Product.insertMany(products);
    console.log(`✅ Seeded ${products.length} products`);

    // Seed admin user
    const existingAdmin = await User.findOne({ email: adminUser.email });
    if (existingAdmin) {
      await User.updateOne(
        { email: adminUser.email },
        { $set: { role: "admin", name: "admin" } }
      );
      console.log("✅ Updated existing user to admin");
    } else {
      await User.create(adminUser);
      console.log("✅ Created admin user");
    }

    console.log("\n📊 Summary:");
    console.log(`   Products: ${products.length}`);
    console.log(`   Admin: admin@gmail.com / admin123456`);

    await mongoose.connection.close();
    console.log("\n✅ Done!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

seedAll();
