"use client";

import React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthMeterProps {
  password?: string;
}

export function PasswordStrengthMeter({ password = "" }: PasswordStrengthMeterProps) {
  const reqs = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const strength = Object.values(reqs).filter(Boolean).length;
  
  // 0-1: weak (red), 2-3: fair (yellow), 4: good (blue), 5: strong (green)
  let color = "bg-red-500";
  if (strength >= 2) color = "bg-yellow-500";
  if (strength >= 4) color = "bg-blue-500";
  if (strength === 5) color = "bg-green-500";

  const width = `${(strength / 5) * 100}%`;

  const ReqItem = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center text-sm ${met ? "text-green-500" : "text-gray-500"}`}>
      {met ? <Check className="w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2" />}
      {text}
    </div>
  );

  return (
    <div className="w-full space-y-2 mt-2">
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${color}`} 
          style={{ width: width === "0%" ? "0%" : width }} 
        />
      </div>
      <div className="grid grid-cols-2 gap-1 mt-2">
        <ReqItem met={reqs.length} text="8+ characters" />
        <ReqItem met={reqs.upper} text="Uppercase letter" />
        <ReqItem met={reqs.lower} text="Lowercase letter" />
        <ReqItem met={reqs.number} text="Number" />
        <ReqItem met={reqs.special} text="Special character" />
      </div>
    </div>
  );
}
