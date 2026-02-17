import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import Category from "../models/category.model.js";
import Shop from "../models/shop.model.js";
import path from "path";
import fs from "fs";

// Helper to delete a local image file given a stored URL (e.g. /images/products/...)
const deleteLocalImage = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    // if it's a remote URL, ignore
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return;

    // Normalize leading slash
    const rel = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
    const fullPath = path.join(process.cwd(), "src", rel);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    console.error("Failed to delete local image", imageUrl, err.message || err);
  }
};

export async function createCustomer(req, res) {
  try {
    const { name, email, password, role, isEmailVerified } = req.body;

    // if file uploaded, construct public URL
    let imageUrl = req.body.imageUrl || "";
    if (req.file) {
      const rel = path.relative(path.join(process.cwd(), "src"), req.file.path).split(path.sep).join("/");
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      imageUrl = `${baseUrl}/${rel}`;
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const customer = await User.create({
      name,
      email,
      password,
      role: role || "user",
      isEmailVerified: isEmailVerified || false,
      imageUrl: imageUrl || "",
    });

    res.status(201).json({ message: "Customer created successfully", customer });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createProduct(req, res) {
  try {
    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      costPrice,
      stock,
      lowStockThreshold,
      category,
      subcategory,
      tags,
      brand,
      vendor,
      discount,
      specifications,
      weight,
      dimensions,
      shippingClass,
      freeShipping,
      isDigital,
      status,
      isFeatured,
      metaDescription,
      adminNotes,
      relatedProducts,
      colors,
      sizes,
      customAttributes,
    } = req.body;

    if (!name || !description || !price || !category) {
      return res.status(400).json({ message: "Name, description, price, and category are required" });
    }

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: "Category not found" });
    }

    // Handle images (saved by multer to src/images/...)
    let images = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 5) {
        return res.status(400).json({ message: "Maximum 5 images allowed" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      images = req.files.map((file, index) => {
        // build public url relative to /src
        const rel = path.relative(path.join(process.cwd(), "src"), file.path).split(path.sep).join("/");
        const url = `${baseUrl}/${rel}`; // e.g. http://localhost:5000/images/products/<folder>/file.jpg
        return { url, alt: name, isPrimary: index === 0 };
      });
    }

    // Parse JSON fields if they're strings
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags || '[]') : tags;
    const parsedDiscount = typeof discount === 'string' ? JSON.parse(discount || '{}') : discount;
    const parsedSpecifications = typeof specifications === 'string' ? JSON.parse(specifications || '[]') : specifications;
    const parsedDimensions = typeof dimensions === 'string' ? JSON.parse(dimensions || '{}') : dimensions;
    const parsedRelatedProducts = typeof relatedProducts === 'string' ? JSON.parse(relatedProducts || '[]') : relatedProducts;
    const parsedColors = typeof colors === 'string' ? JSON.parse(colors || '[]') : colors;
    const parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes || '[]') : sizes;
    const parsedCustomAttributes = typeof customAttributes === 'string' ? JSON.parse(customAttributes || '[]') : customAttributes;

    const product = await Product.create({
      name,
      description,
      shortDescription,
      price: parseFloat(price),
      compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : undefined,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      stock: parseInt(stock) || 0,
      lowStockThreshold: parseInt(lowStockThreshold) || 5,
      category,
      subcategory: subcategory || undefined,
      tags: parsedTags || [],
      brand,
      vendor: vendor || undefined,
      createdBy: req.user._id,
      isAdminProduct: !vendor, // If no vendor, it's an admin product
      discount: parsedDiscount || { type: 'none', value: 0 },
      specifications: parsedSpecifications || [],
      weight: weight ? parseFloat(weight) : 0,
      dimensions: parsedDimensions || {},
      shippingClass: shippingClass || 'standard',
      freeShipping: freeShipping === 'true' || freeShipping === true,
      isDigital: isDigital === 'true' || isDigital === true,
      status: status || 'active',
      isPublished: status === 'active',
      publishedAt: status === 'active' ? new Date() : undefined,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      images,
      metaDescription,
      adminNotes,
      relatedProducts: parsedRelatedProducts || [],
      colors: parsedColors || [],
      sizes: parsedSizes || [],
      customAttributes: parsedCustomAttributes || [],
      approvalStatus: 'approved', // Admin products are auto-approved
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    // Update category stats
    await Category.findByIdAndUpdate(category, {
      $inc: { 'stats.totalProducts': 1, 'stats.activeProducts': status === 'active' ? 1 : 0 }
    });

    // Populate for response
    const populatedProduct = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('vendor', 'name')
      .populate('createdBy', 'name email');

    res.status(201).json({ success: true, product: populatedProduct });
  } catch (error) {
    console.error("Error creating product", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

export async function getAllProducts(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      subcategory,
      vendor,
      status,
      minPrice,
      maxPrice,
      isOnSale,
      isFeatured,
      stockStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Search
    if (search) {
      query.$text = { $search: search };
    }

    // Filters
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (vendor) query.vendor = vendor;
    if (status) query.status = status;
    if (stockStatus) query.stockStatus = stockStatus;
    if (isOnSale === 'true') query.isOnSale = true;
    if (isFeatured === 'true') query.isFeatured = true;

    // Price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .populate('vendor', 'name logo')
        .populate('createdBy', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);

    // Get status counts based on stockStatus
    const stockStatusCounts = await Product.aggregate([
      { $group: { _id: '$stockStatus', count: { $sum: 1 } } }
    ]);

    const statusCounts = {
      total: total,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
      backorder: 0,
    };
    stockStatusCounts.forEach(s => {
      if (s._id === 'in_stock') statusCounts.inStock = s.count;
      else if (s._id === 'low_stock') statusCounts.lowStock = s.count;
      else if (s._id === 'out_of_stock') statusCounts.outOfStock = s.count;
      else if (s._id === 'backorder') statusCounts.backorder = s.count;
    });

    // Convert any relative image URLs to absolute URLs so dev frontend can load them
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const productsForClient = products.map((p) => {
      const obj = p.toObject ? p.toObject() : { ...p };
      if (Array.isArray(obj.images)) {
        obj.images = obj.images.map((img) => {
          if (!img || !img.url) return img;
          if (typeof img.url === "string" && img.url.startsWith("/")) {
            return { ...img, url: `${baseUrl}${img.url}` };
          }
          return img;
        });
      }
      if (obj.thumbnail && typeof obj.thumbnail === "string" && obj.thumbnail.startsWith("/")) {
        obj.thumbnail = `${baseUrl}${obj.thumbnail}`;
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      products: productsForClient,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      statusCounts
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('category', 'name slug attributes')
      .populate('subcategory', 'name slug')
      .populate('vendor', 'name logo email phone owner')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('relatedProducts', 'name images price thumbnail stockStatus');

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const oldCategory = product.category;
    const oldStatus = product.status;

    // Fields that can be updated
    const allowedFields = [
      'name', 'description', 'shortDescription', 'price', 'compareAtPrice',
      'costPrice', 'stock', 'lowStockThreshold', 'category', 'subcategory',
      'tags', 'brand', 'discount', 'specifications', 'weight', 'dimensions',
      'shippingClass', 'freeShipping', 'isDigital', 'status', 'isPublished',
      'isFeatured', 'visibility', 'metaTitle', 'metaDescription', 'adminNotes',
      'hasVariants', 'variants', 'variantOptions', 'allowBackorders', 'approvalStatus',
      'trackInventory', 'vendor', 'relatedProducts', 'colors', 'sizes', 'customAttributes'
    ];

    // Parse JSON fields
    ['tags', 'discount', 'specifications', 'dimensions', 'variants', 'variantOptions', 'existingImages', 'relatedProducts', 'colors', 'sizes', 'customAttributes'].forEach(field => {
      if (updates[field] && typeof updates[field] === 'string') {
        try {
          updates[field] = JSON.parse(updates[field]);
        } catch (e) {
          // Keep as is if parsing fails
        }
      }
    });

    // Handle existing images (when user removes some images in the edit form)
    if (updates.existingImages !== undefined) {
      product.images = updates.existingImages;
    }

    // Handle vendor change
    if (updates.vendor !== undefined) {
      const oldVendorId = product.vendor?.toString();
      const newVendorId = updates.vendor ? updates.vendor.toString() : null;

      if (oldVendorId !== newVendorId) {
        // Import models dynamically to avoid circular dependencies if any
        const Shop = (await import("../models/shop.model.js")).default;

        // Decrement old vendor stats
        if (oldVendorId) {
          await Shop.findByIdAndUpdate(oldVendorId, { $inc: { "stats.totalProducts": -1 } });
        }
        // Increment new vendor stats
        if (newVendorId) {
          await Shop.findByIdAndUpdate(newVendorId, { $inc: { "stats.totalProducts": 1 } });
        }

        // Update isAdminProduct flag
        product.isAdminProduct = !newVendorId;

        // Explicitly set vendor (allowedFields loop might miss null if we don't handle it here or if we rely on it)
        product.vendor = newVendorId;
      }
    }

    // Apply updates
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'vendor') return; // Handled explicitly above to manage stats

        if (field === 'price' || field === 'compareAtPrice' || field === 'costPrice' || field === 'weight') {
          product[field] = parseFloat(updates[field]);
        } else if (field === 'stock' || field === 'lowStockThreshold') {
          product[field] = parseInt(updates[field]);
        } else if (field === 'freeShipping' || field === 'isDigital' || field === 'isFeatured' || field === 'isPublished' || field === 'hasVariants' || field === 'allowBackorders' || field === 'trackInventory') {
          product[field] = updates[field] === 'true' || updates[field] === true;
        } else {
          product[field] = updates[field];
        }
      }
    });

    // Handle new images (saved by multer)
    if (req.files && req.files.length > 0) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const newImages = req.files.map((file, index) => {
        const rel = path.relative(path.join(process.cwd(), "src"), file.path).split(path.sep).join("/");
        const url = `${baseUrl}/${rel}`;
        return { url, alt: product.name, isPrimary: index === 0 && (!product.images || product.images.length === 0) };
      });

      if (updates.replaceImages === 'true') {
        product.images = newImages;
      } else {
        product.images = [...(product.images || []), ...newImages];
      }
    }

    // Update publishedAt if status changed to active
    if (updates.status === 'active' && oldStatus !== 'active') {
      product.isPublished = true;
      product.publishedAt = new Date();
    }

    await product.save();

    // Update category stats if category changed or status changed
    if (product.category && oldCategory && oldCategory.toString() !== product.category.toString()) {
      await Category.findByIdAndUpdate(oldCategory, {
        $inc: { 'stats.totalProducts': -1 }
      });
      await Category.findByIdAndUpdate(product.category, {
        $inc: { 'stats.totalProducts': 1 }
      });
    }

    const populatedProduct = await Product.findById(id)
      .populate('category', 'name slug')
      .populate('subcategory', 'name slug')
      .populate('vendor', 'name')
      .populate('createdBy', 'name email');

    res.status(200).json({ success: true, product: populatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAllOrders(_, res) {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("orderItems.product")
      .sort({ createdAt: -1 });

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error in getAllOrders controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Get list of users with vendor role (for admin selection)
export async function getVendors(req, res) {
  try {
    const vendors = await User.find({ role: "vendor" }).select("_id name email").limit(200);
    res.status(200).json({ success: true, vendors });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
}

export async function updateOrderStatus(req, res) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!["pending", "shipped", "delivered"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.status = status;

    if (status === "shipped" && !order.shippedAt) {
      order.shippedAt = new Date();
    }

    if (status === "delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    await order.save();

    res.status(200).json({ message: "Order status updated successfully", order });
  } catch (error) {
    console.error("Error in updateOrderStatus controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getOrderById(req, res) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate("user", "name email imageUrl phone")
      .populate("orderItems.product", "name images price stock vendor")
      .populate({
        path: "orderItems.product",
        populate: {
          path: "vendor",
          select: "name logo"
        }
      });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error in getOrderById controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateOrder(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Allow updating specific fields
    const allowedFields = ['status', 'shippingAddress'];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        order[field] = updates[field];
      }
    });

    // Set timestamps based on status
    if (updates.status === "shipped" && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (updates.status === "delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    await order.save();

    const updatedOrder = await Order.findById(id)
      .populate("user", "name email")
      .populate("orderItems.product");

    res.status(200).json({ success: true, message: "Order updated successfully", order: updatedOrder });
  } catch (error) {
    console.error("Error in updateOrder controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteOrder(req, res) {
  try {
    const { id } = req.params;

    const order = await Order.findById(id).populate("orderItems.product");
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Restore product stock and update stats
    for (const item of order.orderItems) {
      if (item.product) {
        const productId = item.product._id || item.product;
        const itemRevenue = item.price * item.quantity;

        // Restore stock and reverse stats
        await Product.findByIdAndUpdate(productId, {
          $inc: {
            stock: item.quantity,
            "stats.totalOrders": -1,
            "stats.totalQuantitySold": -item.quantity,
            "stats.totalRevenue": -itemRevenue,
          },
        });
      }
    }

    // Update vendor stats
    const vendorTotals = {};
    for (const item of order.orderItems) {
      if (item.product && item.product.vendor) {
        const vendorId = item.product.vendor.toString();
        if (!vendorTotals[vendorId]) {
          vendorTotals[vendorId] = { total: 0, count: 0 };
        }
        vendorTotals[vendorId].total += item.price * item.quantity;
        vendorTotals[vendorId].count += 1;
      }
    }

    for (const vendorId of Object.keys(vendorTotals)) {
      await Shop.findByIdAndUpdate(vendorId, {
        $inc: {
          "stats.totalOrders": -1,
          "stats.totalRevenue": -vendorTotals[vendorId].total,
        },
      });
    }

    // Delete the order
    await Order.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error in deleteOrder controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAllCustomers(req, res) {
  try {
    const customers = await User.find()
      .populate("wishlist", "name price images")
      .sort({ createdAt: -1 }); // latest user first
    const baseUrl = (req) => `${req.protocol}://${req.get("host")}`;
    // convert any relative imageUrl to absolute
    const customersForClient = customers.map((c) => {
      const obj = c.toObject ? c.toObject() : { ...c };
      if (obj.imageUrl && typeof obj.imageUrl === "string" && obj.imageUrl.startsWith("/")) {
        obj.imageUrl = `${baseUrl(req)}/${obj.imageUrl.replace(/^\//, "")}`;
      }
      return obj;
    });
    res.status(200).json({ customers: customersForClient });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getCustomerById(req, res) {
  try {
    const { id } = req.params;
    const customer = await User.findById(id)
      .populate("wishlist", "name price images");

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Normalize customer image URL
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    if (customer.imageUrl && typeof customer.imageUrl === "string" && customer.imageUrl.startsWith("/")) {
      customer.imageUrl = `${baseUrl}${customer.imageUrl}`;
    }

    // Get customer's orders
    const orders = await Order.find({ user: id })
      .populate("orderItems.product", "name price images")
      .sort({ createdAt: -1 });

    res.status(200).json({ customer, orders });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateCustomer(req, res) {
  try {
    const { id } = req.params;
    const { name, email, role, isEmailVerified, addresses } = req.body;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== customer.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      customer.email = email;
    }

    if (name !== undefined) customer.name = name;
    if (role && ["user", "admin"].includes(role)) customer.role = role;
    if (typeof isEmailVerified === "boolean") customer.isEmailVerified = isEmailVerified;
    if (typeof isEmailVerified === "string") customer.isEmailVerified = isEmailVerified === "true";
    // handle uploaded image file
    if (req.file) {
      try {
        const rel = path.relative(path.join(process.cwd(), "src"), req.file.path).split(path.sep).join("/");
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        customer.imageUrl = `${baseUrl}/${rel}`;
      } catch (err) {
        console.error("Error processing uploaded file path", err);
        return res.status(500).json({ error: "Failed to process uploaded file", details: err.message });
      }
    } else if (req.body.imageUrl !== undefined) {
      customer.imageUrl = req.body.imageUrl;
    }
    if (addresses !== undefined) {
      if (typeof addresses === "string") {
        try {
          customer.addresses = JSON.parse(addresses || "[]");
        } catch (err) {
          customer.addresses = [];
        }
      } else {
        customer.addresses = addresses;
      }
    }

    await customer.save();

    // Fetch updated customer with populated fields
    const updatedCustomer = await User.findById(id).populate("wishlist", "name price images");

    res.status(200).json({ message: "Customer updated successfully", customer: updatedCustomer });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
}

export async function deleteCustomer(req, res) {
  try {
    const { id } = req.params;

    const customer = await User.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Prevent deleting yourself (the admin)
    if (customer._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    // If this customer is a vendor, delete their shops and products
    if (customer.role === "vendor") {
      try {
        const { deleteShopCascade } = await import("../controllers/vendor.controller.js");
        const Shop = (await import("../models/shop.model.js")).default;
        const shops = await Shop.find({ owner: customer._id });
        for (const s of shops) {
          await deleteShopCascade(s._id);
        }
      } catch (err) {
        console.error("Error cascading delete for vendor shops:", err);
        // proceed with deleting user nonetheless
      }
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function suspendCustomer(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const customer = await User.findById(id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // Prevent suspending yourself
    if (customer._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot suspend your own account" });
    }

    customer.isSuspended = true;
    customer.suspendedReason = reason || "";
    customer.suspendedAt = new Date();
    await customer.save();

    res.status(200).json({ message: "Customer suspended", customer });
  } catch (error) {
    console.error("Error suspending customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function reactivateCustomer(req, res) {
  try {
    const { id } = req.params;

    const customer = await User.findById(id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    customer.isSuspended = false;
    customer.suspendedReason = "";
    customer.suspendedAt = null;
    await customer.save();

    res.status(200).json({ message: "Customer reactivated", customer });
  } catch (error) {
    console.error("Error reactivating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getDashboardStats(_, res) {
  try {
    const totalOrders = await Order.countDocuments();

    const revenueResult = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$totalPrice" },
        },
      },
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;

    const totalCustomers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();

    // Revenue by day (last 7 days)
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 6); // 7 days range

    const revenueByDayAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // build last 7 days array with zero-fill
    const revMap = new Map(revenueByDayAgg.map((r) => [r._id, r.total]));
    const revenueByDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      revenueByDay.push({ name: key, value: revMap.get(key) || 0 });
    }

    // Orders by vendor (by joining products -> vendors -> shops)
    const ordersByVendorAgg = await Order.aggregate([
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$productInfo.vendor",
          orders: { $sum: "$orderItems.quantity" },
        },
      },
      {
        $lookup: {
          from: "shops",
          localField: "_id",
          foreignField: "_id",
          as: "shop",
        },
      },
      { $unwind: { path: "$shop", preserveNullAndEmptyArrays: true } },
      { $project: { name: "$shop.name", value: "$orders" } },
      { $sort: { value: -1 } },
      { $limit: 10 },
    ]);

    const ordersByVendor = ordersByVendorAgg.map((r) => ({ name: r.name || "Platform", value: r.value || 0 }));

    // Products by category
    const productsByCategoryAgg = await Product.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
      { $project: { name: "$cat.name", value: "$count" } },
      { $sort: { value: -1 } },
    ]);

    const productsByCategory = productsByCategoryAgg.map((p) => ({ name: p.name || "Uncategorized", value: p.value || 0 }));

    res.status(200).json({
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalProducts,
      revenueByDay,
      ordersByVendor,
      productsByCategory,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete local image files if present
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        const imageUrl = image.url || image;
        await deleteLocalImage(imageUrl);
      }
    }

    // Update category stats
    await Category.findByIdAndUpdate(product.category, {
      $inc: { 'stats.totalProducts': -1 }
    });

    await Product.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
};

// ==================== PRODUCT STATS ====================

export const getProductStats = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .select('name stats buyerInsights purchaseHistory averageRating totalReviews ratingDistribution');

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get recent buyers
    const recentBuyers = await Order.find({
      'orderItems.product': id,
      status: { $in: ['delivered', 'shipped'] }
    })
      .populate('user', 'name email imageUrl')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('user totalPrice createdAt orderItems');

    // Get sales by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const salesByMonth = await Order.aggregate([
      {
        $match: {
          'orderItems.product': product._id,
          createdAt: { $gte: twelveMonthsAgo },
          status: { $in: ['delivered', 'shipped', 'pending'] }
        }
      },
      { $unwind: '$orderItems' },
      { $match: { 'orderItems.product': product._id } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      product: {
        name: product.name,
        stats: product.stats,
        buyerInsights: product.buyerInsights,
        ratings: {
          average: product.averageRating,
          total: product.totalReviews,
          distribution: product.ratingDistribution
        }
      },
      recentBuyers: recentBuyers.map(order => ({
        user: order.user,
        orderTotal: order.totalPrice,
        quantity: order.orderItems.find(i => i.product.toString() === id)?.quantity || 1,
        date: order.createdAt
      })),
      salesByMonth
    });
  } catch (error) {
    console.error("Error fetching product stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== BULK PRODUCT ACTIONS ====================

export const bulkUpdateProducts = async (req, res) => {
  try {
    const { productIds, updates } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "Product IDs are required" });
    }

    const allowedBulkFields = ['status', 'category', 'isFeatured', 'isPublished', 'visibility'];
    const bulkUpdates = {};

    allowedBulkFields.forEach(field => {
      if (updates[field] !== undefined) {
        bulkUpdates[field] = updates[field];
      }
    });

    if (Object.keys(bulkUpdates).length === 0) {
      return res.status(400).json({ message: "No valid updates provided" });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: bulkUpdates }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} products`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error bulk updating products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const bulkDeleteProducts = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "Product IDs are required" });
    }

    // Get products to delete their images
    const products = await Product.find({ _id: { $in: productIds } });

    // Delete local image files for each product
    for (const product of products) {
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          const imageUrl = image.url || image;
          await deleteLocalImage(imageUrl);
        }
      }
    }

    const result = await Product.deleteMany({ _id: { $in: productIds } });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} products`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error bulk deleting products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== PRODUCT IMAGE MANAGEMENT ====================

export const deleteProductImage = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const index = parseInt(imageIndex);
    if (index < 0 || index >= product.images.length) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    const image = product.images[index];
    const imageUrl = image.url || image;

    // Delete local file
    await deleteLocalImage(imageUrl);

    product.images.splice(index, 1);
    await product.save();

    res.json({ success: true, message: "Image deleted", product });
  } catch (error) {
    console.error("Error deleting product image:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const setPrimaryImage = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const index = parseInt(imageIndex);
    if (index < 0 || index >= product.images.length) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    // Reset all to non-primary
    product.images.forEach((img, i) => {
      img.isPrimary = i === index;
    });

    await product.save();

    res.json({ success: true, message: "Primary image set", product });
  } catch (error) {
    console.error("Error setting primary image:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};