import { Expo } from "expo-server-sdk";
import { User } from "../models/user.model.js";

const expo = new Expo();

/**
 * Send a push notification to a single user by their userId.
 *
 * @param {string} recipientId - The MongoDB _id of the recipient user
 * @param {object} payload - { title, body, data }
 */
export async function sendPushToUser(recipientId, { title, body, data = {} }) {
  try {
    const user = await User.findById(recipientId).select("expoPushToken");

    if (!user?.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) {
      return; // User doesn't have a valid push token
    }

    const messages = [
      {
        to: user.expoPushToken,
        sound: "dengo_notification.wav",
        title,
        body,
        data,
        priority: "high",
        channelId: "dengo",
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error("Error sending push chunk:", err);
      }
    }
  } catch (error) {
    console.error("Error in sendPushToUser:", error);
  }
}

/**
 * Send push notifications to multiple users at once.
 *
 * @param {string[]} recipientIds - Array of MongoDB user _ids
 * @param {object} payload - { title, body, data }
 */
export async function sendPushToUsers(recipientIds, { title, body, data = {} }) {
  try {
    const users = await User.find({
      _id: { $in: recipientIds },
      expoPushToken: { $ne: "" },
    }).select("expoPushToken");

    const messages = users
      .filter((u) => Expo.isExpoPushToken(u.expoPushToken))
      .map((u) => ({
        to: u.expoPushToken,
        sound: "dengo_notification.wav",
        title,
        body,
        data,
        priority: "high",
        channelId: "dengo",
      }));

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error("Error sending push chunk:", err);
      }
    }
  } catch (error) {
    console.error("Error in sendPushToUsers:", error);
  }
}
