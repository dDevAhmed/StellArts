"use client";

import React from "react";
import { UserOut } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Wallet } from "lucide-react";

interface ProfileCardProps {
  user: UserOut;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const { address } = useWallet();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Profile Overview</span>
          <Badge variant={user.role === "artisan" ? "default" : "secondary"}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3 text-gray-700">
          <User className="w-5 h-5 text-indigo-500" />
          <span className="font-medium">{user.full_name || "No name provided"}</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-700">
          <Mail className="w-5 h-5 text-indigo-500" />
          <span>{user.email}</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-700">
          <Phone className="w-5 h-5 text-indigo-500" />
          <span>{user.phone || "No phone provided"}</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-700">
          <Wallet className="w-5 h-5 text-indigo-500" />
          <span className="break-all font-mono text-sm">
            {address ? address : "Wallet not connected"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
