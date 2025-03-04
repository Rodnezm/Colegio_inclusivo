const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Ruta para registro de usuario
router.post(
  "/register",
  [
    body("nomb_user")
      .isLength({ min: 3 })
      .withMessage("El nombre de usuario debe tener al menos 3 caracteres"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    body("tipo_user")
      .isIn(["admin", "profesor", "estudiante"])
      .withMessage("Tipo de usuario no válido"),
  ],
  authController.register,
);

// Ruta para inicio de sesión
router.post(
  "/login",
  [
    body("nomb_user")
      .exists()
      .withMessage("Debe proporcionar un nombre de usuario"),
    body("password").exists().withMessage("Debe proporcionar una contraseña"),
  ],
  authController.login,
);

/*// Ruta para refresh token
router.post(
  "/refresh-token",
  [
    body("refreshToken")
      .exists()
      .withMessage("Debe proporcionar el refresh token"),
  ],
  authController.refreshToken,
);*/

// Ruta para cerrar sesión
router.post("/logout", authController.logout);

// Ruta para recuperar contraseña
router.post(
  "/forgot-password",
  [
    body("email")
      .isEmail()
      .withMessage("Debe proporcionar un correo electrónico válido"),
  ],
  authController.forgotPassword,
);

// Ruta para restablecer contraseña
router.post(
  "/reset-password",
  [
    body("token").exists().withMessage("Token requerido"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
  ],
  authController.resetPassword,
);

// Rutas protegidas (requieren autenticación)
// Obtener configuración de accesibilidad
router.get(
  "/accessibility",
  authMiddleware.verifyToken,
  authController.getAccessibilityConfig,
);

// Actualizar configuración de accesibilidad
router.put(
  "/accessibility",
  authMiddleware.verifyToken,
  authController.updateAccessibilityConfig,
);

module.exports = router;

/*
// Ruta para registro de tutor
router.post(
  "/register-tutor",
  [
    body("nomb_user")
      .isLength({ min: 3 })
      .withMessage("El nombre de usuario debe tener al menos 3 caracteres"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    body("nomb_tut")
      .not().isEmpty()
      .withMessage("El nombre del tutor es obligatorio"),
    body("ape_tut")
      .not().isEmpty()
      .withMessage("El apellido del tutor es obligatorio"),
    body("ci_tu")
      .not().isEmpty()
      .withMessage("La cédula del tutor es obligatoria"),
    body("email_tut")
      .optional()
      .isEmail()
      .withMessage("Correo electrónico no válido")
  ],
  authController.registerTutor
);*/