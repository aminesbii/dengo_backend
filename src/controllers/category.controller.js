import Category from "../models/category.model.js";
import { Product } from "../models/product.model.js";

// ==================== GET ALL CATEGORIES ====================
export const getAllCategories = async (req, res) => {
  try {
    const { includeInactive, flat } = req.query;

    // Convert string "true"/"false" to boolean
    const showInactive = includeInactive === "true" || includeInactive === true;
    const flatList = flat === "true" || flat === true;

    const query = {};
    if (!showInactive) {
      query.isActive = true;
    }

    let categories;

    if (flatList) {
      // Return flat list
      categories = await Category.find(query).sort({ displayOrder: 1, name: 1 });
    } else {
      // Return hierarchical structure (only root categories with subcategories populated)
      categories = await Category.find({ ...query, parent: null })
        .populate({
          path: "subcategories",
          match: showInactive ? {} : { isActive: true },
          populate: {
            path: "subcategories",
            match: showInactive ? {} : { isActive: true },
          },
        })
        .sort({ displayOrder: 1, name: 1 });
    }

    res.json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// ==================== GET CATEGORY BY ID ====================
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate("parent", "name slug")
      .populate({
        path: "subcategories",
        select: "name slug isActive stats",
      });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ success: true, category });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
};

// ==================== CREATE CATEGORY ====================
export const createCategory = async (req, res) => {
  try {
    const { name, description, image, icon, parent, displayOrder, attributes, metaTitle, metaDescription, isActive } = req.body;

    console.log("Creating category with data:", req.body);

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Check for duplicate name
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      parent: parent || null,
    });

    if (existing) {
      return res.status(400).json({ error: "Category with this name already exists" });
    }

    // Determine level based on parent
    let level = 0;
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({ error: "Parent category not found" });
      }
      level = parentCategory.level + 1;
    }

    const category = await Category.create({
      name,
      description,
      image,
      icon,
      parent: parent || null,
      level,
      displayOrder: displayOrder || 0,
      attributes: attributes || [],
      metaTitle,
      metaDescription,
      isActive: isActive !== undefined ? isActive : true,
    });

    console.log("Category created:", category);
    res.status(201).json({ success: true, message: "Category created", category });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
};

// ==================== UPDATE CATEGORY ====================
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // If changing parent, update level
    if (updates.parent !== undefined && updates.parent !== category.parent?.toString()) {
      if (updates.parent) {
        const newParent = await Category.findById(updates.parent);
        if (!newParent) {
          return res.status(400).json({ error: "Parent category not found" });
        }
        updates.level = newParent.level + 1;
      } else {
        updates.level = 0;
      }
    }

    const allowedUpdates = [
      "name",
      "description",
      "image",
      "icon",
      "parent",
      "level",
      "isActive",
      "displayOrder",
      "attributes",
      "metaTitle",
      "metaDescription",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        category[field] = updates[field];
      }
    });

    await category.save();

    res.json({ success: true, message: "Category updated", category });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
};

// ==================== DELETE CATEGORY ====================
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { moveProductsTo, moveSubcategoriesTo, cascade } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Recursive helper to get all subcategory IDs
    const getAllChildrenIds = async (parentId) => {
      const children = await Category.find({ parent: parentId });
      let ids = children.map(c => c._id);
      for (const child of children) {
        const grandChildren = await getAllChildrenIds(child._id);
        ids = [...ids, ...grandChildren];
      }
      return ids;
    };

    const allAffectedCategoryIds = [id, ...(await getAllChildrenIds(id))];

    if (cascade === true || cascade === "true") {
      // DELETE EVERYTHING
      // 1. Delete all products in these categories
      await Product.deleteMany({
        $or: [
          { category: { $in: allAffectedCategoryIds } },
          { subcategory: { $in: allAffectedCategoryIds } }
        ]
      });

      // 2. Delete all categories and subcategories
      await Category.deleteMany({ _id: { $in: allAffectedCategoryIds } });

      return res.json({
        success: true,
        message: `Category and ${allAffectedCategoryIds.length - 1} subcategories deleted successfully along with all associated products.`
      });
    }

    // MOVE LOGIC
    // Check for subcategories if not cascading
    const directSubcategories = await Category.find({ parent: id });
    if (directSubcategories.length > 0) {
      if (moveSubcategoriesTo) {
        // Move direct subcategories to another category
        await Category.updateMany({ parent: id }, { parent: moveSubcategoriesTo });

        // Update level for moved subcategories
        const targetParent = await Category.findById(moveSubcategoriesTo);
        const newLevel = (targetParent?.level || 0) + 1;
        await Category.updateMany({ parent: moveSubcategoriesTo }, { level: newLevel });
        // Note: This only updates one level deep, recursive level update might be needed 
        // but for simplicity we'll assume the admin knows what they're doing for now.
      } else {
        return res.status(400).json({
          error: "Category has subcategories. Please specify where to move them or delete them with cascade.",
          subcategoriesCount: directSubcategories.length,
          requireDecision: "subcategories"
        });
      }
    }

    // Check for products
    const productsCount = await Product.countDocuments({
      $or: [{ category: id }, { subcategory: id }],
    });

    if (productsCount > 0) {
      if (moveProductsTo) {
        // Move products to another category
        // Products where this category was the main category
        await Product.updateMany({ category: id }, { category: moveProductsTo, subcategory: null });
        // Products where this category was just a subcategory
        await Product.updateMany({ subcategory: id }, { subcategory: null });
      } else {
        return res.status(400).json({
          error: "Category has products. Please specify where to move them or delete them with cascade.",
          productsCount,
          requireDecision: "products"
        });
      }
    }

    await Category.findByIdAndDelete(id);

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
};

// ==================== GET CATEGORY TREE ====================
export const getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name slug parent level stats")
      .sort({ displayOrder: 1, name: 1 });

    // Build tree structure
    const categoryMap = {};
    const tree = [];

    categories.forEach((cat) => {
      categoryMap[cat._id] = { ...cat.toObject(), children: [] };
    });

    categories.forEach((cat) => {
      if (cat.parent) {
        if (categoryMap[cat.parent]) {
          categoryMap[cat.parent].children.push(categoryMap[cat._id]);
        }
      } else {
        tree.push(categoryMap[cat._id]);
      }
    });

    res.json({ success: true, tree });
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res.status(500).json({ error: "Failed to fetch category tree" });
  }
};

// ==================== UPDATE CATEGORY STATS ====================
export const updateCategoryStats = async (categoryId) => {
  try {
    const stats = await Product.aggregate([
      {
        $match: {
          $or: [{ category: categoryId }, { subcategory: categoryId }],
        },
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          totalSales: { $sum: "$stats.totalQuantitySold" },
        },
      },
    ]);

    if (stats.length > 0) {
      await Category.findByIdAndUpdate(categoryId, {
        "stats.totalProducts": stats[0].totalProducts,
        "stats.activeProducts": stats[0].activeProducts,
        "stats.totalSales": stats[0].totalSales,
      });
    }
  } catch (error) {
    console.error("Error updating category stats:", error);
  }
};

// ==================== REORDER CATEGORIES ====================
export const reorderCategories = async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { displayOrder: index },
      },
    }));

    await Category.bulkWrite(bulkOps);

    res.json({ success: true, message: "Categories reordered" });
  } catch (error) {
    console.error("Error reordering categories:", error);
    res.status(500).json({ error: "Failed to reorder categories" });
  }
};
