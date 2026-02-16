import mongoose from "mongoose";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import Category from "../models/category.model.js";
import { ENV } from "../config/env.js";

const adminUser = {
  name: "admin",
  email: "admin@gmail.com",
  password: "admin123456",
  role: "admin",
  isEmailVerified: true,
};

// Categories with subcategories
const categories = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Gadgets, devices, and tech accessories",
    icon: "📱",
    level: 0,
    displayOrder: 1,
    isActive: true,
    subcategories: [
      { name: "Smartphones", slug: "smartphones", description: "Mobile phones and accessories", icon: "📱" },
      { name: "Laptops & Computers", slug: "laptops-computers", description: "Notebooks and desktop computers", icon: "💻" },
      { name: "Audio", slug: "audio", description: "Headphones, speakers, and audio equipment", icon: "🎧" },
      { name: "Wearables", slug: "wearables", description: "Smartwatches and fitness trackers", icon: "⌚" },
      { name: "Gaming", slug: "gaming", description: "Gaming consoles, accessories, and PC gaming", icon: "🎮" },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Clothing, shoes, and accessories for all",
    icon: "👗",
    level: 0,
    displayOrder: 2,
    isActive: true,
    subcategories: [
      { name: "Men's Clothing", slug: "mens-clothing", description: "Apparel for men", icon: "👔" },
      { name: "Women's Clothing", slug: "womens-clothing", description: "Apparel for women", icon: "👗" },
      { name: "Shoes", slug: "shoes", description: "Footwear for all occasions", icon: "👟" },
      { name: "Bags & Accessories", slug: "bags-accessories", description: "Handbags, wallets, and more", icon: "👜" },
      { name: "Jewelry", slug: "jewelry", description: "Rings, necklaces, and accessories", icon: "💍" },
    ],
  },
  {
    name: "Home & Living",
    slug: "home-living",
    description: "Furniture, decor, and home essentials",
    icon: "🏠",
    level: 0,
    displayOrder: 3,
    isActive: true,
    subcategories: [
      { name: "Furniture", slug: "furniture", description: "Chairs, tables, and storage", icon: "🪑" },
      { name: "Kitchen & Dining", slug: "kitchen-dining", description: "Cookware and dining essentials", icon: "🍳" },
      { name: "Bedding", slug: "bedding", description: "Sheets, pillows, and comforters", icon: "🛏️" },
      { name: "Decor", slug: "decor", description: "Decorative items and artwork", icon: "🖼️" },
    ],
  },
  {
    name: "Sports & Outdoors",
    slug: "sports-outdoors",
    description: "Athletic gear and outdoor equipment",
    icon: "⚽",
    level: 0,
    displayOrder: 4,
    isActive: true,
    subcategories: [
      { name: "Exercise & Fitness", slug: "exercise-fitness", description: "Gym equipment and accessories", icon: "🏋️" },
      { name: "Outdoor Recreation", slug: "outdoor-recreation", description: "Camping and hiking gear", icon: "🏕️" },
      { name: "Team Sports", slug: "team-sports", description: "Equipment for team sports", icon: "🏀" },
      { name: "Cycling", slug: "cycling", description: "Bikes and cycling accessories", icon: "🚴" },
    ],
  },
  {
    name: "Beauty & Health",
    slug: "beauty-health",
    description: "Skincare, makeup, and wellness products",
    icon: "💄",
    level: 0,
    displayOrder: 5,
    isActive: true,
    subcategories: [
      { name: "Skincare", slug: "skincare", description: "Face and body care products", icon: "🧴" },
      { name: "Makeup", slug: "makeup", description: "Cosmetics and beauty tools", icon: "💄" },
      { name: "Hair Care", slug: "hair-care", description: "Shampoos, styling, and treatment", icon: "💇" },
      { name: "Health & Wellness", slug: "health-wellness", description: "Vitamins and health products", icon: "💊" },
    ],
  },
  {
    name: "Books & Media",
    slug: "books-media",
    description: "Books, music, movies, and more",
    icon: "📚",
    level: 0,
    displayOrder: 6,
    isActive: true,
    subcategories: [
      { name: "Fiction", slug: "fiction", description: "Novels and stories", icon: "📖" },
      { name: "Non-Fiction", slug: "non-fiction", description: "Educational and informational books", icon: "📘" },
      { name: "Music", slug: "music", description: "CDs, vinyl, and instruments", icon: "🎵" },
      { name: "Movies & TV", slug: "movies-tv", description: "DVDs, Blu-rays, and streaming", icon: "🎬" },
    ],
  },
];

const products = [
  {
    name: "Wireless Bluetooth Headphones",
    description:
      "Premium over-ear headphones with active noise cancellation, 30-hour battery life, and premium sound quality. Perfect for music lovers and travelers.",
    price: 149.99,
    stock: 50,
    category: "Electronics",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500",
    ],
    averageRating: 4.5,
    totalReviews: 128,
  },
  {
    name: "Smart Watch Series 5",
    description:
      "Advanced fitness tracking, heart rate monitor, GPS, and water-resistant design. Stay connected with notifications and apps on your wrist.",
    price: 299.99,
    stock: 35,
    category: "Electronics",
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
      "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500",
    ],
    averageRating: 4.7,
    totalReviews: 256,
  },
  {
    name: "Leather Crossbody Bag",
    description:
      "Handcrafted genuine leather bag with adjustable strap. Features multiple compartments and elegant design perfect for daily use.",
    price: 89.99,
    stock: 25,
    category: "Fashion",
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500",
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500",
    ],
    averageRating: 4.3,
    totalReviews: 89,
  },
  {
    name: "Running Shoes - Pro Edition",
    description:
      "Lightweight running shoes with responsive cushioning and breathable mesh upper. Designed for performance and comfort during long runs.",
    price: 129.99,
    stock: 60,
    category: "Sports & Outdoors",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500",
    ],
    averageRating: 4.6,
    totalReviews: 342,
  },
  {
    name: "Bestselling Mystery Novel",
    description:
      "A gripping psychological thriller that will keep you on the edge of your seat. New York Times bestseller with over 1 million copies sold.",
    price: 24.99,
    stock: 100,
    category: "Books & Media",
    images: [
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500",
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500",
    ],
    averageRating: 4.8,
    totalReviews: 1243,
  },
  {
    name: "Portable Bluetooth Speaker",
    description:
      "Waterproof wireless speaker with 360-degree sound, 12-hour battery life, and durable design. Perfect for outdoor adventures.",
    price: 79.99,
    stock: 45,
    category: "Electronics",
    images: [
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500",
      "https://images.unsplash.com/photo-1589003077984-894e133dabab?w=500",
    ],
    averageRating: 4.4,
    totalReviews: 167,
  },
  {
    name: "Classic Denim Jacket",
    description:
      "Timeless denim jacket with vintage wash and comfortable fit. A wardrobe essential that pairs perfectly with any outfit.",
    price: 69.99,
    stock: 40,
    category: "Fashion",
    images: [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500",
      "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=500",
    ],
    averageRating: 4.2,
    totalReviews: 95,
  },
  {
    name: "Yoga Mat Pro",
    description:
      "Extra-thick non-slip yoga mat with carrying strap. Eco-friendly material provides excellent cushioning and grip for all yoga styles.",
    price: 49.99,
    stock: 75,
    category: "Sports & Outdoors",
    images: [
      "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500",
      "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500",
    ],
    averageRating: 4.5,
    totalReviews: 203,
  },
  {
    name: "Mechanical Keyboard RGB",
    description:
      "Gaming keyboard with customizable RGB lighting, mechanical switches, and programmable keys. Built for gamers and typing enthusiasts.",
    price: 119.99,
    stock: 30,
    category: "Electronics",
    images: [
      "https://images.unsplash.com/photo-1595225476474-87563907a212?w=500",
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500",
    ],
    averageRating: 4.7,
    totalReviews: 421,
  },
  {
    name: "Coffee Table Book Collection",
    description:
      "Stunning photography book featuring architecture and design from around the world. Hardcover edition with 300+ pages of inspiration.",
    price: 39.99,
    stock: 55,
    category: "Books & Media",
    images: [
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=500",
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=500",
    ],
    averageRating: 4.6,
    totalReviews: 134,
  },
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(ENV.DB_URL);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    console.log("🗑️  Cleared existing products and categories");

    // Seed categories with subcategories
    const categoryMap = {};
    for (const cat of categories) {
      const { subcategories: subs, ...catData } = cat;
      const parentCategory = await Category.create(catData);
      categoryMap[cat.name] = parentCategory._id;
      console.log(`✅ Created category: ${cat.name}`);

      if (subs && subs.length > 0) {
        for (let i = 0; i < subs.length; i++) {
          const subCat = await Category.create({
            ...subs[i],
            parent: parentCategory._id,
            level: 1,
            displayOrder: i + 1,
            isActive: true,
          });
          console.log(`   └─ Subcategory: ${subCat.name}`);
        }
      }
    }

    // Get or create admin user for product ownership
    let adminUserDoc = await User.findOne({ email: adminUser.email });
    if (!adminUserDoc) {
      adminUserDoc = await User.create(adminUser);
      console.log("✅ Successfully seeded admin user");
    } else {
      console.log("⚠️  Admin user already exists");
    }

    // Create products one by one (to trigger pre-save hooks for slug/sku generation)
    console.log("\n📦 Creating products...");
    for (const p of products) {
      const productData = {
        ...p,
        category: categoryMap[p.category] || null,
        images: p.images.map((url, idx) => ({ url, isPrimary: idx === 0 })),
        createdBy: adminUserDoc._id,
        isAdminProduct: true,
        approvalStatus: "approved",
        isPublished: true,
        status: "active",
      };
      delete productData.averageRating;
      delete productData.totalReviews;
      
      await Product.create(productData);
      console.log(`   ✅ ${p.name}`);
    }
    console.log(`\n✅ Successfully seeded ${products.length} products`);

    // Display summary
    const totalCategories = await Category.countDocuments();
    const parentCategories = await Category.countDocuments({ level: 0 });
    const subCategories = await Category.countDocuments({ level: 1 });
    
    console.log("\n📊 Seeding Summary:");
    console.log(`Total Categories: ${totalCategories} (${parentCategories} main, ${subCategories} sub)`);
    console.log(`Total Products: ${products.length}`);

    // Close connection
    await mongoose.connection.close();
    console.log("\n✅ Database seeding completed and connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();