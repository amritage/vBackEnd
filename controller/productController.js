const { body, validationResult } = require("express-validator");
const Product = require("../model/Product");
const Substructure = require("../model/Substructure");
const Content = require("../model/Content");
const Design = require("../model/Design");
const Subfinish = require("../model/Subfinish");
const Subsuitable = require("../model/Subsuitable");
const Vendor = require("../model/Vendor");
const Groupcode = require("../model/Groupcode");
const Color = require("../model/Color");
const Category = require("../model/Category");
const Motif = require("../model/Motif");
const { cloudinaryServices } = require("../services/cloudinary.service.js");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
// Update multer middleware to accept 'video' field
const multiUpload = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "image1", maxCount: 1 },
  { name: "image2", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);
const slugify = require("slugify");

// 🚀 OPTIMIZED VALIDATION - Single batch validation
const validate = [
  body("name")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters")
    .notEmpty()
    .withMessage("Name is required"),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Category must be a valid Mongo ID"),
  body("substructure")
    .notEmpty()
    .withMessage("Substructure is required")
    .isMongoId()
    .withMessage("Substructure must be a valid Mongo ID"),
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isMongoId()
    .withMessage("Content must be a valid Mongo ID"),
  body("design")
    .notEmpty()
    .withMessage("Design is required")
    .isMongoId()
    .withMessage("Design must be a valid Mongo ID"),
  body("subfinish")
    .notEmpty()
    .withMessage("Subfinish is required")
    .isMongoId()
    .withMessage("Subfinish must be a valid Mongo ID"),
  body("subsuitable")
    .notEmpty()
    .withMessage("Subsuitable is required")
    .isMongoId()
    .withMessage("Subsuitable must be a valid Mongo ID"),
  body("vendor")
    .notEmpty()
    .withMessage("Vendor is required")
    .isMongoId()
    .withMessage("Vendor must be a valid Mongo ID"),
  body("groupcode")
    .notEmpty()
    .withMessage("Groupcode is required")
    .isMongoId()
    .withMessage("Groupcode must be a valid Mongo ID"),
  body("color")
    .notEmpty()
    .withMessage("Color is required")
    .isMongoId()
    .withMessage("Color must be a valid Mongo ID"),
  body("motif")
    .optional()
    .isMongoId()
    .withMessage("Motif must be a valid Mongo ID"),
  body("um").optional().isString(),
  body("currency").optional().isString(),
  body("gsm").optional().isNumeric(),
  body("oz").optional().isNumeric(),
  body("cm").optional().isNumeric(),
  body("inch").optional().isNumeric(),
];

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    if (!req.files || !req.files.file || !req.files.file[0]) {
      return res
        .status(400)
        .json({ success: false, message: "Image is required" });
    }
    const {
      name,
      category,
      substructure,
      content,
      design,
      subfinish,
      subsuitable,
      vendor,
      groupcode,
      color,
      motif,
      um,
      currency,
      gsm,
      oz,
      cm,
      inch,
    } = req.body;

    // 🚀 BATCH VALIDATION - Check all references in parallel
    const validationPromises = [
      Category.exists({ _id: category }),
      Substructure.exists({ _id: substructure }),
      Content.exists({ _id: content }),
      Design.exists({ _id: design }),
      Subfinish.exists({ _id: subfinish }),
      Subsuitable.exists({ _id: subsuitable }),
      Vendor.exists({ _id: vendor }),
      Groupcode.exists({ _id: groupcode }),
      Color.exists({ _id: color }),
    ];

    const validationResults = await Promise.all(validationPromises);
    const invalidRefs = validationResults.filter((exists) => !exists);

    if (invalidRefs.length > 0) {
      return res.status(400).json({
        success: false,
        message: "One or more referenced entities do not exist",
      });
    }

    // Validate motif if provided
    if (motif) {
      const motifExists = await Motif.exists({ _id: motif });
      if (!motifExists) {
        return res
          .status(400)
          .json({ success: false, message: "Motif not found" });
      }
    }

    // Fetch the category name for folder naming
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res
        .status(400)
        .json({ success: false, message: "Category not found" });
    }
    const categoryFolder = slugify(categoryDoc.name, {
      lower: true,
      strict: true,
    });

    // Upload main image
    const uploadResult = await cloudinaryServices.cloudinaryImageUpload(
      req.files.file[0].buffer,
      name,
      categoryFolder
    );
    if (uploadResult.error) {
      return res.status(500).json({
        success: false,
        message: "Image upload failed",
      });
    }
    const img = uploadResult.secure_url;

    // Upload image1 (if present)
    let image1Url = "";
    if (req.files.image1 && req.files.image1[0]) {
      const upload1 = await cloudinaryServices.cloudinaryImageUpload(
        req.files.image1[0].buffer,
        name + "-image1",
        categoryFolder
      );
      if (upload1 && upload1.secure_url) image1Url = upload1.secure_url;
    }
    // Upload image2 (if present)
    let image2Url = "";
    if (req.files.image2 && req.files.image2[0]) {
      const upload2 = await cloudinaryServices.cloudinaryImageUpload(
        req.files.image2[0].buffer,
        name + "-image2",
        categoryFolder
      );
      if (upload2 && upload2.secure_url) image2Url = upload2.secure_url;
    }

    // Upload video (if present)
    let videoUrl = "";
    let videoThumbnailUrl = "";
    if (req.files.video && req.files.video[0]) {
      const videoResult = await cloudinaryServices.cloudinaryImageUpload(
        req.files.video[0].buffer,
        name + "-video",
        categoryFolder,
        false,
        "video"
      );
      // Extract AV1 video and thumbnail URLs
      if (videoResult && videoResult.eager && videoResult.eager.length > 0) {
        videoUrl = videoResult.eager[0].secure_url || videoResult.secure_url;
        videoThumbnailUrl =
          videoResult.eager[1] && videoResult.eager[1].secure_url
            ? videoResult.eager[1].secure_url
            : "";
      } else if (videoResult && videoResult.secure_url) {
        videoUrl = videoResult.secure_url;
      }
    }
    const product = new Product({
      name,
      img,
      image1: image1Url,
      image2: image2Url,
      video: videoUrl,
      videoThumbnail: videoThumbnailUrl,
      category,
      substructure,
      content,
      design,
      subfinish,
      subsuitable,
      vendor,
      groupcode,
      color,
      motif,
      um,
      currency,
      gsm,
      oz,
      cm,
      inch,
    });

    await product.save();

    // 🚀 OPTIMIZED POPULATION - Only populate essential fields
    const populated = await Product.findById(product._id)
      .populate("category", "name")
      .populate("substructure", "name")
      .populate("content", "name")
      .populate("design", "name")
      .populate("subfinish", "name")
      .populate("subsuitable", "name")
      .populate("vendor", "name")
      .populate("groupcode", "name")
      .populate("color", "name")
      .populate("motif", "name")
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, error });
  }
};

const viewAll = async (req, res) => {
  try {
    // 🚀 ULTRA-FAST PRODUCT QUERY OPTIMIZATIONS
    const limit = parseInt(req.query.limit) || 50; // Increased default limit
    const page = parseInt(req.query.page) || 1;
    const fields = req.query.fields
      ? req.query.fields.split(",").join(" ")
      : "";
    const skip = (page - 1) * limit;

    // 🚀 PARALLEL EXECUTION for faster queries
    const [products, total] = await Promise.all([
      Product.find({}, fields)
        .skip(skip)
        .limit(limit)
        .lean() // Convert to plain objects for speed
        .populate("category", "name")
        .populate("substructure", "name")
        .populate("content", "name")
        .populate("design", "name")
        .populate("subfinish", "name")
        .populate("subsuitable", "name")
        .populate("vendor", "name")
        .populate("groupcode", "name")
        .populate("color", "name")
        .populate("motif", "name")
        .exec(),
      Product.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, error });
  }
};

const viewById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("substructure", "name")
      .populate("content", "name")
      .populate("design", "name")
      .populate("subfinish", "name")
      .populate("subsuitable", "name")
      .populate("vendor", "name")
      .populate("groupcode", "name")
      .populate("color", "name")
      .populate("motif", "name");
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, error });
  }
};

const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Fetch the product to get old image URLs and category for folder
    const oldProduct = await Product.findById(id).lean();
    if (!oldProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    // Get category name for folder
    let categoryFolder = "products";
    if (updateData.category || oldProduct.category) {
      const categoryId = updateData.category || oldProduct.category;
      const categoryDoc = await Category.findById(categoryId);
      if (categoryDoc) {
        categoryFolder = slugify(categoryDoc.name, {
          lower: true,
          strict: true,
        });
      }
    }

    // Handle main image (img)
    if (req.files && req.files.file && req.files.file[0]) {
      const uploadResult = await cloudinaryServices.cloudinaryImageUpload(
        req.files.file[0].buffer,
        req.body.name || oldProduct.name || "product",
        categoryFolder
      );
      if (uploadResult && uploadResult.secure_url) {
        // Delete old image from Cloudinary
        if (oldProduct.img) {
          const publicId = oldProduct.img.split("/").pop().split(".")[0];
          cloudinaryServices
            .cloudinaryImageDelete(publicId)
            .catch(console.error);
        }
        updateData.img = uploadResult.secure_url;
      }
    }
    // Handle image1
    if (req.files && req.files.image1 && req.files.image1[0]) {
      const upload1 = await cloudinaryServices.cloudinaryImageUpload(
        req.files.image1[0].buffer,
        (req.body.name || oldProduct.name || "product") + "-image1",
        categoryFolder
      );
      if (upload1 && upload1.secure_url) {
        if (oldProduct.image1) {
          const publicId = oldProduct.image1.split("/").pop().split(".")[0];
          cloudinaryServices
            .cloudinaryImageDelete(publicId)
            .catch(console.error);
        }
        updateData.image1 = upload1.secure_url;
      }
    }
    // Handle image2
    if (req.files && req.files.image2 && req.files.image2[0]) {
      const upload2 = await cloudinaryServices.cloudinaryImageUpload(
        req.files.image2[0].buffer,
        (req.body.name || oldProduct.name || "product") + "-image2",
        categoryFolder
      );
      if (upload2 && upload2.secure_url) {
        if (oldProduct.image2) {
          const publicId = oldProduct.image2.split("/").pop().split(".")[0];
          cloudinaryServices
            .cloudinaryImageDelete(publicId)
            .catch(console.error);
        }
        updateData.image2 = upload2.secure_url;
      }
    }

    // Handle video
    if (req.files && req.files.video && req.files.video[0]) {
      const videoResult = await cloudinaryServices.cloudinaryImageUpload(
        req.files.video[0].buffer,
        (req.body.name || oldProduct.name || "product") + "-video",
        categoryFolder,
        false,
        "video"
      );
      if (videoResult && videoResult.eager && videoResult.eager.length > 0) {
        if (oldProduct.video) {
          const publicId = oldProduct.video.split("/").pop().split(".")[0];
          cloudinaryServices
            .cloudinaryImageDelete(publicId)
            .catch(console.error);
        }
        updateData.video =
          videoResult.eager[0].secure_url || videoResult.secure_url;
        updateData.videoThumbnail =
          videoResult.eager[1] && videoResult.eager[1].secure_url
            ? videoResult.eager[1].secure_url
            : "";
      } else if (videoResult && videoResult.secure_url) {
        updateData.video = videoResult.secure_url;
      }
    }

    // 🚀 BATCH VALIDATION if references are being updated
    if (
      updateData.category ||
      updateData.substructure ||
      updateData.content ||
      updateData.design ||
      updateData.subfinish ||
      updateData.subsuitable ||
      updateData.vendor ||
      updateData.groupcode ||
      updateData.color ||
      updateData.motif
    ) {
      const validationPromises = [];
      if (updateData.category)
        validationPromises.push(Category.exists({ _id: updateData.category }));
      if (updateData.substructure)
        validationPromises.push(
          Substructure.exists({ _id: updateData.substructure })
        );
      if (updateData.content)
        validationPromises.push(Content.exists({ _id: updateData.content }));
      if (updateData.design)
        validationPromises.push(Design.exists({ _id: updateData.design }));
      if (updateData.subfinish)
        validationPromises.push(
          Subfinish.exists({ _id: updateData.subfinish })
        );
      if (updateData.subsuitable)
        validationPromises.push(
          Subsuitable.exists({ _id: updateData.subsuitable })
        );
      if (updateData.vendor)
        validationPromises.push(Vendor.exists({ _id: updateData.vendor }));
      if (updateData.groupcode)
        validationPromises.push(
          Groupcode.exists({ _id: updateData.groupcode })
        );
      if (updateData.color)
        validationPromises.push(Color.exists({ _id: updateData.color }));
      if (updateData.motif)
        validationPromises.push(Motif.exists({ _id: updateData.motif }));

      if (validationPromises.length > 0) {
        const validationResults = await Promise.all(validationPromises);
        const invalidRefs = validationResults.filter((exists) => !exists);
        if (invalidRefs.length > 0) {
          return res.status(400).json({
            success: false,
            message: "One or more referenced entities do not exist",
          });
        }
      }
    }

    // Sanitize updateData
    Object.keys(updateData).forEach(
      (key) =>
        (updateData[key] === "" ||
          updateData[key] === undefined ||
          updateData[key] === null) &&
        delete updateData[key]
    );

    const updated = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate([
        { path: "category", select: "name" },
        { path: "substructure", select: "name" },
        { path: "content", select: "name" },
        { path: "design", select: "name" },
        { path: "subfinish", select: "name" },
        { path: "subsuitable", select: "name" },
        { path: "vendor", select: "name" },
        { path: "groupcode", select: "name" },
        { path: "color", select: "name" },
        { path: "motif", select: "name" },
      ])
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteById = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    // Remove image file
    if (deleted.img) {
      const publicId = deleted.img.split("/").pop().split(".")[0];
      await cloudinaryServices.cloudinaryImageDelete(publicId);
    }
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  upload,
  multiUpload,
  create,
  viewAll,
  viewById,
  update,
  deleteById,
  validate,
};
