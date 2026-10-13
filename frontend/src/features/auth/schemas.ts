import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    role: z.enum(["student", "employer"]),
    full_name: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: passwordSchema,
    company_name: z.string().trim().max(160).optional(),
  })
  .refine((v) => v.role !== "employer" || (v.company_name && v.company_name.length >= 2), {
    path: ["company_name"],
    message: "Enter your company name",
  });

export const forgotSchema = z.object({ email: z.string().min(1, "Email is required").email("Enter a valid email address") });

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
