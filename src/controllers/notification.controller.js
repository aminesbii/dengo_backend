import { Notification } from "../models/notification.model.js";
import { sendPushToUser, sendPushToUsers } from "../services/pushNotifications.js";

// Get all notifications for the logged-in user
export async function getNotifications(req, res) {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("order", "status totalPrice")
        .populate("product", "name images price")
        .populate("shop", "name logo"),
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

// Get unread notification count
export async function getUnreadCount(req, res) {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
}

// Mark a single notification as read
export async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
}

// Mark all notifications as read
export async function markAllAsRead(req, res) {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
}

// Delete a notification
export async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
}

// ==================== HELPER: Create notification (used by other controllers) ====================
export async function createNotification({ recipient, type, title, message, order, product, shop }) {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      order,
      product,
      shop,
    });

    // Send real-time push notification
    sendPushToUser(recipient, {
      title,
      body: message,
      data: {
        type,
        notificationId: notification._id.toString(),
        ...(order && { orderId: order.toString() }),
        ...(product && { productId: product.toString() }),
        ...(shop && { shopId: shop.toString() }),
      },
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

// Bulk create notifications (for shop followers)
export async function createBulkNotifications(recipients, { type, title, message, product, shop }) {
  try {
    const notifications = recipients.map((recipientId) => ({
      recipient: recipientId,
      type,
      title,
      message,
      product,
      shop,
    }));
    await Notification.insertMany(notifications);

    // Send real-time push notifications to all recipients
    sendPushToUsers(recipients, {
      title,
      body: message,
      data: {
        type,
        ...(product && { productId: product.toString() }),
        ...(shop && { shopId: shop.toString() }),
      },
    });
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
  }
}
