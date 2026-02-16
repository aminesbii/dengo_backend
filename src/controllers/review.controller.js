import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { Review } from "../models/review.model.js";
import Shop from "../models/shop.model.js";

export async function createReview(req, res) {
  try {
    const { productId, shopId, orderId, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    if (!productId && !shopId) {
      return res.status(400).json({ error: "productId or shopId is required" });
    }

    const user = req.user;

    // If product review: require orderId and verify order
    if (productId) {
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required for product reviews" });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (order.user.toString() !== user._id.toString()) {
        return res.status(403).json({ error: "Not authorized to review this order" });
      }
      if (order.status !== "delivered") {
        return res.status(400).json({ error: "Can only review delivered orders" });
      }

      const productInOrder = order.orderItems.find(
        (item) => item.product.toString() === productId.toString()
      );
      if (!productInOrder) {
        return res.status(400).json({ error: "Product not found in this order" });
      }

      const review = await Review.findOneAndUpdate(
        { productId, userId: user._id },
        { rating, orderId, productId, userId: user._id, comment },
        { new: true, upsert: true, runValidators: true }
      );

      // update product stats
      const reviews = await Review.find({ productId });
      const totalRating = reviews.reduce((sum, rev) => sum + rev.rating, 0);
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        {
          averageRating: reviews.length > 0 ? totalRating / reviews.length : 0,
          totalReviews: reviews.length,
        },
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        await Review.findByIdAndDelete(review._id);
        return res.status(404).json({ error: "Product not found" });
      }

      return res.status(201).json({ message: "Review submitted successfully", review });
    }

    // Shop-only review: any authenticated user can rate a shop
    if (shopId) {
      const shopDoc = await Shop.findById(shopId);
      if (!shopDoc) {
        return res.status(404).json({ error: "Shop not found" });
      }

      const review = await Review.findOneAndUpdate(
        { shopId, userId: user._id },
        { rating, shopId, userId: user._id, comment },
        { new: true, upsert: true, runValidators: true }
      );

      // update shop stats
      const shopReviews = await Review.find({ shopId });
      const totalRating = shopReviews.reduce((sum, rev) => sum + rev.rating, 0);
      await Shop.findByIdAndUpdate(
        shopId,
        {
          "stats.averageRating": shopReviews.length > 0 ? totalRating / shopReviews.length : 0,
          "stats.totalReviews": shopReviews.length,
        },
        { new: true, runValidators: true }
      );

      return res.status(201).json({ message: "Shop review submitted successfully", review });
    }
  } catch (error) {
    console.error("Error in createReview controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteReview(req, res) {
  try {
    const { reviewId } = req.params;

    const user = req.user;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this review" });
    }

    const productId = review.productId;
    const shopId = review.shopId;
    await Review.findByIdAndDelete(reviewId);

    if (productId) {
      const reviews = await Review.find({ productId });
      const totalRating = reviews.reduce((sum, rev) => sum + rev.rating, 0);
      await Product.findByIdAndUpdate(productId, {
        averageRating: reviews.length > 0 ? totalRating / reviews.length : 0,
        totalReviews: reviews.length,
      });
    }

    if (shopId) {
      const shopReviews = await Review.find({ shopId });
      const totalRating = shopReviews.reduce((sum, rev) => sum + rev.rating, 0);
      await Shop.findByIdAndUpdate(shopId, {
        "stats.averageRating": shopReviews.length > 0 ? totalRating / shopReviews.length : 0,
        "stats.totalReviews": shopReviews.length,
      });
    }

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error in deleteReview controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update an existing review (rating and/or comment)
export async function updateReview(req, res) {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const user = req.user;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to update this review" });
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      review.rating = rating;
    }
    if (comment !== undefined) {
      review.comment = comment;
    }

    await review.save();

    // Recalculate stats
    if (review.productId) {
      const reviews = await Review.find({ productId: review.productId });
      const totalRating = reviews.reduce((sum, rev) => sum + rev.rating, 0);
      await Product.findByIdAndUpdate(review.productId, {
        averageRating: reviews.length > 0 ? totalRating / reviews.length : 0,
        totalReviews: reviews.length,
      });
    }

    if (review.shopId) {
      const shopReviews = await Review.find({ shopId: review.shopId });
      const totalRating = shopReviews.reduce((sum, rev) => sum + rev.rating, 0);
      await Shop.findByIdAndUpdate(review.shopId, {
        "stats.averageRating": shopReviews.length > 0 ? totalRating / shopReviews.length : 0,
        "stats.totalReviews": shopReviews.length,
      });
    }

    const populated = await Review.findById(review._id).populate("userId", "name imageUrl");
    res.status(200).json({ message: "Review updated successfully", review: populated });
  } catch (error) {
    console.error("Error in updateReview controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get all reviews for a vendor's shop (product reviews + shop reviews)
export async function getVendorReviews(req, res) {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({ error: "You don't have a shop yet" });
    }

    // Get all product IDs belonging to this shop
    const products = await Product.find({ vendor: shop._id }).select("_id name images");
    const productIds = products.map((p) => p._id);

    // Fetch product reviews and shop reviews in parallel
    const [productReviews, shopReviews] = await Promise.all([
      Review.find({ productId: { $in: productIds } })
        .populate("userId", "name email imageUrl")
        .populate("productId", "name images price")
        .sort({ createdAt: -1 }),
      Review.find({ shopId: shop._id })
        .populate("userId", "name email imageUrl")
        .sort({ createdAt: -1 }),
    ]);

    // Tag each review with its type and normalize field names for the frontend
    const allReviews = [
      ...productReviews.map((r) => {
        const obj = r.toObject();
        return {
          _id: obj._id,
          user: obj.userId,
          product: obj.productId,
          shop: null,
          rating: obj.rating,
          comment: obj.comment,
          createdAt: obj.createdAt,
          type: "product",
        };
      }),
      ...shopReviews.map((r) => {
        const obj = r.toObject();
        return {
          _id: obj._id,
          user: obj.userId,
          product: null,
          shop: { _id: shop._id, name: shop.name },
          rating: obj.rating,
          comment: obj.comment,
          createdAt: obj.createdAt,
          type: "shop",
        };
      }),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Compute rating distribution
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach((r) => {
      if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++;
    });

    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

    res.json({
      success: true,
      reviews: allReviews,
      stats: {
        totalReviews: allReviews.length,
        total: allReviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
        ratingDistribution: ratingDist,
        distribution: ratingDist,
      },
    });
  } catch (error) {
    console.error("Error fetching vendor reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
}

// Get reviews for a specific product (public)
export async function getProductReviews(req, res) {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ productId })
      .populate("userId", "name imageUrl")
      .sort({ createdAt: -1 });

    // Compute stats
    const total = reviews.length;
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++;
    });
    const avgRating =
      total > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
        : 0;

    res.json({
      success: true,
      reviews,
      stats: {
        totalReviews: total,
        averageRating: avgRating,
        ratingDistribution: ratingDist,
      },
    });
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
}

// Get reviews for a specific shop (public)
export async function getShopReviews(req, res) {
  try {
    const { shopId } = req.params;
    const reviews = await Review.find({ shopId })
      .populate("userId", "name imageUrl")
      .sort({ createdAt: -1 });

    const total = reviews.length;
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++;
    });
    const avgRating =
      total > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
        : 0;

    res.json({
      success: true,
      reviews,
      stats: {
        totalReviews: total,
        averageRating: avgRating,
        ratingDistribution: ratingDist,
      },
    });
  } catch (error) {
    console.error("Error fetching shop reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
}