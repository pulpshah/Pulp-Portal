"use client";

import { useState, useEffect, Suspense, SetStateAction } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme";
import { useTheme } from "next-themes";
import Image from "next/image";
import { Button, Input, Logo } from "@pulp/ui";

// Create a separate component that uses useSearchParams
function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Theme state management
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      // Sign in the user automatically after successful registration
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (result?.error) {
        router.push("/auth/signin");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An error occurred during registration");
      }
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    signIn("google", { callbackUrl });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  //TODO: For some reason, the theme is not being set correctly. Its the opposite of what it should be.
  //console.log(theme);
  // Get theme-aware brand for Logo
  const getLogoBrand = () => {
    if (!mounted) return "gravitas-black"; // Default fallback for SSR
    //TODO: For some reason, the theme is not being set correctly. Its the opposite of what it should be.
    //Quick fix for now. Will fix later.
    return theme === "dark" ? "gravitas-black" : "blank-logic";
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ background: "var(--background)" }}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div
        className="w-full max-w-md space-y-8 p-8 rounded-lg shadow-xl"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--card-border)",
          borderWidth: "1px",
        }}
      >
        <div className="flex flex-col items-center">
          <Logo size="lg" brand={getLogoBrand()} />
          <h2
            className="text-2xl"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-primary)",
            }}
          >
            Create a new account
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Or{" "}
            <Button onClick={() => router.push("/auth/signin")} variant="link">
              sign in to your account
            </Button>
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="mt-6">
          <Button
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 rounded-md border px-4"
            variant="secondary"
          >
            <Image src="/google-logo.svg" alt="Google" width={18} height={18} />
            Sign up with Google
          </Button>
        </div>

        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span
              className="px-2"
              style={{
                background: "var(--card-bg)",
                color: "var(--text-muted)",
              }}
            >
              Or continue with
            </span>
          </div>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                variant="brand"
                required
                value={name}
                onChange={(e: { target: { value: SetStateAction<string> } }) =>
                  setName(e.target.value)
                }
                placeholder="Full Name"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                variant="brand"
                required
                value={email}
                onChange={(e: { target: { value: SetStateAction<string> } }) =>
                  setEmail(e.target.value)
                }
                placeholder="Email address"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                variant="brand"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e: { target: { value: SetStateAction<string> } }) =>
                  setPassword(e.target.value)
                }
                placeholder="Password"
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                variant="brand"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e: { target: { value: SetStateAction<string> } }) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="Confirm Password"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              variant="brand"
              disabled={isLoading}
              className="gradient-button group relative flex w-full justify-center rounded-md py-2 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                // @ts-expect-error - CSS custom property type not recognized by TypeScript
                "--tw-ring-color": "var(--gradient-start)",
                "--tw-ring-offset-color": "var(--background)",
              }}
            >
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Loading fallback component
function SignUpLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ background: "var(--background)" }}
    >
      <div
        className="w-full max-w-md space-y-8 p-8 rounded-lg shadow-xl"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--card-border)",
          borderWidth: "1px",
        }}
      >
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gray-300 animate-pulse rounded-full mb-4"></div>
          <div className="h-8 bg-gray-300 animate-pulse rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 animate-pulse rounded w-1/2"></div>
        </div>
        <div className="space-y-4 mt-8">
          <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
          <div className="h-px bg-gray-600 w-full"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-300 animate-pulse rounded w-1/4"></div>
            <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
            <div className="h-4 bg-gray-300 animate-pulse rounded w-1/4"></div>
            <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
            <div className="h-4 bg-gray-300 animate-pulse rounded w-1/4"></div>
            <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
            <div className="h-4 bg-gray-300 animate-pulse rounded w-1/4"></div>
            <div className="h-10 bg-gray-300 animate-pulse rounded"></div>
          </div>
          <div className="h-10 bg-gray-300 animate-pulse rounded mt-6"></div>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function SignUp() {
  return (
    <Suspense fallback={<SignUpLoading />}>
      <SignUpForm />
    </Suspense>
  );
}
