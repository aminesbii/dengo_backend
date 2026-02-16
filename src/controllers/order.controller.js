import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { Review } from "../models/review.model.js";
import Shop from "../models/shop.model.js";
import { createNotification } from "./notification.controller.js";

export async function createOrder(req, res) {
  try {
    const user = req.user;
    const { orderItems, shippingAddress, paymentResult, totalPrice } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ error: "No order items" });
    }

    // validate products and stock
    for (const item of orderItems) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(404).json({ error: `Product ${item.name} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
    }

    const order = await Order.create({
      user: user._id,
      orderItems,
      shippingAddress,
      paymentResult,
      totalPrice,
    });

    // update product stock AND product-level stats
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const item of orderItems) {
      const productId = item.product._id || item.product;
      const itemRevenue = item.price * item.quantity;

      // Update stock and stats atomically
      await Product.findByIdAndUpdate(productId, {
        $inc: {
          stock: -item.quantity,
          "stats.totalOrders": 1,
          "stats.totalQuantitySold": item.quantity,
          "stats.totalRevenue": itemRevenue,
        },
        $set: { "stats.lastSoldAt": now },
      });

      // Update purchase history (keep last 500)
      const product = await Product.findById(productId);
      if (product) {
        // Add purchase record
        product.purchaseHistory.push({
          user: user._id,
          order: order._id,
          quantity: item.quantity,
          priceAtPurchase: item.price,
          purchasedAt: now,
        });
        // Trim to last 500
        if (product.purchaseHistory.length > 500) {
          product.purchaseHistory = product.purchaseHistory.slice(-500);
        }

        // Update buyerInsights
        const existingBuyer = product.purchaseHistory.filter(
          (p) => p.user?.toString() === user._id.toString()
        );
        const totalBuyers = new Set(
          product.purchaseHistory.map((p) => p.user?.toString()).filter(Boolean)
        ).size;
        const repeatBuyers = [...new Set(
          product.purchaseHistory.map((p) => p.user?.toString()).filter(Boolean)
        )].filter((uid) => product.purchaseHistory.filter((p) => p.user?.toString() === uid).length > 1).length;

        product.buyerInsights.totalBuyers = totalBuyers;
        product.buyerInsights.repeatBuyers = repeatBuyers;
        product.buyerInsights.repeatBuyerRate = totalBuyers > 0 ? (repeatBuyers / totalBuyers) * 100 : 0;
        product.buyerInsights.averageOrderQuantity = product.stats.totalQuantitySold / Math.max(product.stats.totalOrders, 1);

        // Update buyersByMonth
        const monthEntry = product.buyerInsights.buyersByMonth.find((b) => b.month === monthKey);
        if (monthEntry) {
          monthEntry.count += 1;
          monthEntry.revenue += itemRevenue;
        } else {
          product.buyerInsights.buyersByMonth.push({
            month: monthKey,
            count: 1,
            revenue: itemRevenue,
          });
        }

        await product.save();
      }
    }

    // Update shop stats for each vendor in the order
    // Group orderItems by vendor
    const vendorTotals = {};
    for (const item of orderItems) {
      const product = await Product.findById(item.product._id || item.product);
      if (product && product.vendor) {
        const vendorId = product.vendor.toString();
        if (!vendorTotals[vendorId]) {
          vendorTotals[vendorId] = { total: 0, count: 0 };
        }
        vendorTotals[vendorId].total += item.price * item.quantity;
        vendorTotals[vendorId].count += 1;
      }
    }
    for (const vendorId of Object.keys(vendorTotals)) {
      await Shop.findByIdAndUpdate(
        vendorId,
        {
          $inc: {
            "stats.totalOrders": 1,
            "stats.totalRevenue": vendorTotals[vendorId].total,
          },
        }
      );
    }

    // Notify the user about the new order
    await createNotification({
      recipient: user._id,
      type: "order_status",
      title: "Order Placed",
      message: `Your order #${order._id.toString().slice(-6)} has been placed successfully!`,
      order: order._id,
    });

    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    console.error("Error in createOrder controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUserOrders(req, res) {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    // check if each order has been reviewed

    const orderIds = orders.map((order) => order._id);
    const reviews = await Review.find({ orderId: { $in: orderIds } });
    const reviewedOrderIds = new Set(reviews.map((review) => review.orderId.toString()));

    const ordersWithReviewStatus = await Promise.all(
      orders.map(async (order) => {
        return {
          ...order.toObject(),
          hasReviewed: reviewedOrderIds.has(order._id.toString()),
        };
      })
    );

    res.status(200).json({ orders: ordersWithReviewStatus });
  } catch (error) {
    console.error("Error in getUserOrders controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update order status (for vendors)
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id).populate("orderItems.product");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get vendor's shop
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(403).json({ error: "You don't have a shop" });
    }

    // Verify vendor owns products in this order
    const hasVendorProducts = order.orderItems.some(
      item => item.product?.vendor?.toString() === shop._id.toString()
    );

    if (!hasVendorProducts) {
      return res.status(403).json({ error: "You can only update orders containing your products" });
    }

    // Validate status (vendors can only set these statuses)
    const allowedStatuses = ["processing", "shipped", "delivered"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Allowed: processing, shipped, delivered" });
    }

    // Update status
    order.status = status;

    // Set timestamps
    if (status === "shipped") {
      order.shippedAt = new Date();
    } else if (status === "delivered") {
      order.deliveredAt = new Date();
    }

    await order.save();

    // Notify the customer about the status change
    const statusMessages = {
      processing: "is now being processed",
      shipped: "has been shipped",
      delivered: "has been delivered",
    };
    await createNotification({
      recipient: order.user,
      type: "order_status",
      title: "Order Update",
      message: `Your order #${order._id.toString().slice(-6)} ${statusMessages[status] || "has been updated"}.`,
      order: order._id,
    });

    res.json({
      success: true,
      message: "Order status updated",
      order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
}

// Get orders for a specific vendor
export async function getVendorOrders(req, res) {
  try {
    const Shop = (await import("../models/shop.model.js")).default;
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    // Find orders that contain products from this vendor
    const orders = await Order.find({
      "orderItems.product": { $exists: true }
    })
      .populate("orderItems.product")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    // Filter orders to only include those where at least one item belongs to this vendor
    const vendorOrders = orders.filter(order =>
      order.orderItems.some(item =>
        item.product?.vendor?.toString() === shop._id.toString()
      )
    ).map(order => {
      // For each order, only return items belonging to this vendor to avoid leaking other vendors' data
      const myItems = order.orderItems.filter(item =>
        item.product?.vendor?.toString() === shop._id.toString()
      );

      const vendorTotal = myItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        ...order.toObject(),
        orderItems: myItems,
        vendorTotal
      };
    });

    res.json({ success: true, orders: vendorOrders });
  } catch (error) {
    console.error("Error fetching vendor orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

