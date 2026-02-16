import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const sampleCities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Miami", "Atlanta"];
const sampleStreets = ["Main St", "Market St", "Broadway", "Elm St", "Maple Ave", "Oak St"];

const seedOrders = async ({ count = 200 } = {}) => {
  try {
    await mongoose.connect(ENV.DB_URL);
    console.log("✅ Connected to MongoDB");

    const products = await Product.find({}).limit(200);
    if (!products || products.length === 0) {
      console.error("No products found. Run product seed first.");
      process.exit(1);
    }

    const users = await User.find({}).limit(200);
    if (!users || users.length === 0) {
      console.error("No users found. Run user seeds first.");
      process.exit(1);
    }

    const ordersToInsert = [];

    for (let i = 0; i < count; i++) {
      const numItems = randomInt(1, 4);
      const chosen = [];
      for (let j = 0; j < numItems; j++) {
        // pick unique product per order
        let p = pick(products);
        let attempts = 0;
        while (chosen.find((c) => c.product && c.product.toString() === p._id.toString()) && attempts < 10) {
          p = pick(products);
          attempts++;
        }
        const qty = randomInt(1, 5);
        const price = typeof p.salePrice === 'number' && p.salePrice > 0 ? p.salePrice : p.price || 0;
        chosen.push({ product: p._id, name: p.name, price, quantity: qty, image: p.thumbnail || (p.images && p.images[0]?.url) || "" });
      }

      const subtotal = chosen.reduce((s, it) => s + it.price * it.quantity, 0);
      const shipping = Math.random() < 0.3 ? randomInt(0, 15) : 5; // random shipping
      const totalPrice = parseFloat((subtotal + shipping).toFixed(2));

      // random createdAt within last 45 days
      const createdAt = new Date(Date.now() - randomInt(0, 45) * 24 * 60 * 60 * 1000 - randomInt(0, 24*60*60*1000));

      const user = pick(users);

      const order = {
        user: user._id,
        orderItems: chosen,
        shippingAddress: {
          fullName: user.name || user.email || 'Customer',
          streetAddress: `${randomInt(10,999)} ${pick(sampleStreets)}`,
          city: pick(sampleCities),
          state: 'State',
          zipCode: `${randomInt(10000,99999)}`,
          phoneNumber: user.phone || `+1${randomInt(2000000000,9999999999)}`,
        },
        paymentResult: { id: `pay_${Math.random().toString(36).slice(2,9)}`, status: 'paid' },
        totalPrice,
        status: pick(['pending','shipped','delivered']),
        createdAt,
        updatedAt: createdAt,
      };

      // mark deliveredAt/shippedAt depending on status
      if (order.status === 'shipped') order.shippedAt = new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000);
      if (order.status === 'delivered') order.deliveredAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);

      ordersToInsert.push(order);
    }

    const inserted = await Order.insertMany(ordersToInsert);
    console.log(`✅ Inserted ${inserted.length} orders`);

    // Update product stats increments
    for (const ord of inserted) {
      for (const it of ord.orderItems) {
        const qty = it.quantity || 1;
        const rev = (it.price || 0) * qty;
        await Product.findByIdAndUpdate(it.product, {
          $inc: {
            'stats.totalOrders': 1,
            'stats.totalQuantitySold': qty,
            'stats.totalRevenue': rev,
          },
          $set: { 'stats.lastSoldAt': ord.createdAt }
        });
      }
    }

    console.log('✅ Updated product stats from seeded orders');

    await mongoose.connection.close();
    console.log('✅ Done');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding orders', err);
    process.exit(1);
  }
};

seedOrders({ count: 200 });
