"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { Loader2 } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "client" as "client" | "artisan",
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // 1. Register
      await api.auth.register({
        email: formData.email,
        password: formData.password,
        role: formData.role,
        full_name: formData.fullName,
        phone: formData.phone,
      });

      // 2. Auto-login
      const { access_token } = await api.auth.login({ 
        email: formData.email, 
        password: formData.password 
      });
      const user = await api.users.me(access_token);
      
      login(access_token, user);
      router.push("/dashboard");
    } catch (error) {
      const err = error as any;
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input 
            id="fullName" name="fullName" type="text" required 
            value={formData.fullName} onChange={handleChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input 
            id="phone" name="phone" type="tel" 
            value={formData.phone} onChange={handleChange}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" name="email" type="email" required 
          value={formData.email} onChange={handleChange}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="role">I want to</Label>
        <select 
          id="role" name="role" required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          value={formData.role}
          onChange={handleChange}
        >
          <option value="client">Hire an Artisan (Client)</option>
          <option value="artisan">Offer Services (Artisan)</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input 
          id="password" name="password" type="password" required 
          value={formData.password} onChange={handleChange}
        />
        <PasswordStrengthMeter password={formData.password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input 
          id="confirmPassword" name="confirmPassword" type="password" required 
          value={formData.confirmPassword} onChange={handleChange}
        />
      </div>

      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Create Account"}
      </Button>
    </form>
  );
}
