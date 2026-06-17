"use client";

import React, { useState, useEffect } from "react";
import { api, ArtisanItem, ArtisanProfileUpdate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";

export function ArtisanProfileForm() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ArtisanProfileUpdate>({
    business_name: "",
    description: "",
    specialties: [],
    hourly_rate: 0,
    location: "",
  });

  const [specialtiesStr, setSpecialtiesStr] = useState("");

  useEffect(() => {
    if (!token) return;
    
    api.artisans.me(token)
      .then((artisan) => {
        setFormData({
          business_name: artisan.business_name || "",
          description: artisan.description || "",
          hourly_rate: artisan.hourly_rate || 0,
          location: artisan.location || "",
          specialties: typeof artisan.specialties === 'string' 
            ? JSON.parse(artisan.specialties || '[]') 
            : artisan.specialties || [],
        });
        let parsedSpecs: string[] = [];
        const rawSpecs = artisan.specialties;
        if (typeof rawSpecs === 'string') {
          try { 
            parsedSpecs = JSON.parse(rawSpecs); 
          } catch { 
            parsedSpecs = [rawSpecs]; 
          }
        } else if (Array.isArray(rawSpecs)) {
          parsedSpecs = rawSpecs;
        }
        setSpecialtiesStr(parsedSpecs.join(", "));
      })
      .catch((error) => {
        // Ignored. They might not have an artisan profile yet.
      })
      .finally(() => setFetching(false));
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: ArtisanProfileUpdate) => ({ 
      ...prev, 
      [name]: type === 'number' ? parseFloat(value) : value 
    }));
  };

  const handleSpecialtiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpecialtiesStr(e.target.value);
    const specs = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
    setFormData((prev: ArtisanProfileUpdate) => ({ ...prev, specialties: specs }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await api.artisans.updateProfile(formData, token);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const err = error as any;
      setError(err.message || "Failed to update artisan profile.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>;
  }

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Artisan Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <AlertDescription className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Artisan profile updated successfully.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name</Label>
            <Input 
              id="business_name" name="business_name" type="text"
              value={formData.business_name || ""} onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialties">Specialties (comma-separated)</Label>
            <Input 
              id="specialties" name="specialties" type="text" placeholder="e.g. Plumbing, Electrician"
              value={specialtiesStr} onChange={handleSpecialtiesChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate (XLM)</Label>
              <Input 
                id="hourly_rate" name="hourly_rate" type="number" min="0" step="0.1"
                value={formData.hourly_rate || ""} onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location" name="location" type="text"
                value={formData.location || ""} onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Bio / Description</Label>
            <Textarea 
              id="description" name="description" rows={4}
              value={formData.description || ""} onChange={handleChange}
            />
          </div>

          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Update Artisan Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
