"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearCoursePlacementState,
  readCoursePlacementState,
} from "@/lib/course-placement";
import type { SessionUser, SignInData, SignUpData } from "@/types/auth";

type AuthResponse = {
  ok: boolean;
  error?: string;
};

type ApiAuthResponse = {
  user?: SessionUser;
  error?: string;
};

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  signIn: (payload: SignInData) => Promise<AuthResponse>;
  signUp: (payload: SignUpData) => Promise<AuthResponse>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = await readJson<ApiAuthResponse>(response);
  return data?.user ?? null;
}

async function syncGuestCoursePlacementToAccount() {
  const placement = readCoursePlacementState();
  if (
    !placement.completed ||
    !placement.recommendedLevelNumber ||
    !placement.recommendedLevelSlug
  ) {
    return;
  }

  const response = await fetch("/api/courses/placement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recommendedLevelNumber: placement.recommendedLevelNumber,
      recommendedLevelSlug: placement.recommendedLevelSlug,
      preserveExisting: true,
    }),
  });

  if (response.ok) {
    clearCoursePlacementState();
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const nextUser = await fetchCurrentUser();
        if (!active) {
          return;
        }
        setUser(nextUser);
      } catch {
        if (!active) {
          return;
        }
        setUser(null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async ({ email, password }: SignInData): Promise<AuthResponse> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson<ApiAuthResponse>(response);

      if (!response.ok || !data?.user) {
        return { ok: false, error: data?.error ?? "Ошибка входа." };
      }

      setUser(data.user);
      void syncGuestCoursePlacementToAccount();
      return { ok: true };
    } catch {
      return { ok: false, error: "Не удалось выполнить вход." };
    }
  }, []);

  const signUp = useCallback(async (payload: SignUpData): Promise<AuthResponse> => {
    try {
      const placement = readCoursePlacementState();
      const coursePlacement =
        placement.completed &&
        placement.recommendedLevelNumber &&
        placement.recommendedLevelSlug
          ? {
              recommendedLevelNumber: placement.recommendedLevelNumber,
              recommendedLevelSlug: placement.recommendedLevelSlug,
            }
          : undefined;
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, coursePlacement }),
      });
      const data = await readJson<ApiAuthResponse>(response);

      if (!response.ok || !data?.user) {
        return { ok: false, error: data?.error ?? "Ошибка регистрации." };
      }

      setUser(data.user);
      if (coursePlacement) {
        clearCoursePlacementState();
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Не удалось создать аккаунт." };
    }
  }, []);

  const signOut = useCallback(() => {
    void fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      signIn,
      signUp,
      signOut,
    }),
    [isLoading, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
