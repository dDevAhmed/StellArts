import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-6 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Welcome back
          </h2>
          <p className="text-sm text-gray-600">
            Sign in to access your StellArts dashboard
          </p>
        </div>
        
        <div className="px-8 pb-8">
          <LoginForm />
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
