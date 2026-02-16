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

const categoryNames = ["Electronics", "Fashion", "Home", "Sports", "Food"];

const productTemplates = [
    { name: "Pro Headphones", price: 199.99, category: "Electronics", brand: "AudioTech" },
    { name: "Gaming Mouse", price: 79.99, category: "Electronics", brand: "Logi" },
    { name: "Smart Watch", price: 249.99, category: "Electronics", brand: "Pixel" },
    { name: "Laptop Pro", price: 1299.99, category: "Electronics", brand: "Fruit" },
    { name: "Running Shoes", price: 120, category: "Sports", brand: "Nike" },
    { name: "Yoga Mat", price: 35, category: "Sports", brand: "Lulu" },
    { name: "Dumbbell Set", price: 85, category: "Sports", brand: "Iron" },
    { name: "Hoodie", price: 55, category: "Fashion", brand: "H&M" },
    { name: "Slim Jeans", price: 45, category: "Fashion", brand: "Levi" },
    { name: "Summer Dress", price: 65, category: "Fashion", brand: "Zara" },
    { name: "Leather Wallet", price: 30, category: "Fashion", brand: "Coach" },
    { name: "Desk Lamp", price: 40, category: "Home", brand: "IKEA" },
    { name: "Coffee Maker", price: 150, category: "Home", brand: "Nespresso" },
    { name: "Blender Max", price: 80, category: "Home", brand: "Ninja" },
    { name: "Throw Blanket", price: 25, category: "Home", brand: "HomeGood" },
    { name: "Organic Espresso", price: 18, category: "Food", brand: "Star" },
    { name: "Protein Powder", price: 45, category: "Food", brand: "Optimum" },
    { name: "Matcha Tea", price: 22, category: "Food", brand: "Zen" },
    { name: "Wireless Keyboard", price: 60, category: "Electronics", brand: "Keychron" },
    { name: "Backpack Pro", price: 90, category: "Fashion", brand: "Osprey" },
];

const seedProducts = async () => {
    try {
        await mongoose.connect(ENV.DB_URL);
        console.log("✅ Connected to MongoDB");

        // 1. Ensure Admin exists
        let admin = await User.findOne({ email: adminUser.email });
        if (!admin) {
            admin = await User.create(adminUser);
            console.log("✅ Created admin user");
        } else {
            console.log("ℹ️  Found existing admin user");
        }

        // 2. Ensure Categories exist
        const categoryMap = {};
        for (const name of categoryNames) {
            let cat = await Category.findOne({ name });
            if (!cat) {
                cat = await Category.create({ name, description: `All about ${name}` });
                console.log(`✅ Created category: ${name}`);
            }
            categoryMap[name] = cat._id;
        }

        // 3. Drop problematic index
        try {
            await mongoose.connection.collection("products").dropIndex("sku_1");
            console.log("🗑️  Dropped sku index");
        } catch (e) { }

        // 4. Clear existing products
        await Product.deleteMany({});
        console.log("🗑️  Cleared existing products");

        // 5. Generate and insert 20 products
        const finalProducts = productTemplates.map((p, i) => ({
            ...p,
            category: categoryMap[p.category],
            description: `Premium ${p.name} from ${p.brand}. Features high quality materials and durability. Perfect for daily use and professional needs.`,
            stock: 50 + (i * 5),
            images: [
                {
                    url: `https://picsum.photos/id/${10 + i}/600/600`,
                    alt: p.name,
                    isPrimary: true
                },
                {
                    url: `https://picsum.photos/id/${50 + i}/600/600`,
                    alt: `${p.name} alternate`,
                    isPrimary: false
                }
            ],
            createdBy: admin._id,
            status: "active",
            isPublished: true,
            publishedAt: new Date(),
            shippingClass: "standard",
            weight: 500,
            averageRating: 4.0 + (Math.random()),
            totalReviews: 10 + Math.floor(Math.random() * 90),
            colors: ["Black", "White", "Silver"],
            sizes: ["S", "M", "L", "XL"]
        }));

        await Product.create(finalProducts);
        console.log(`✅ Successfully seeded ${finalProducts.length} products`);

        await mongoose.connection.close();
        console.log("✅ Database connection closed");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding products:", error);
        process.exit(1);
    }
};

seedProducts();
