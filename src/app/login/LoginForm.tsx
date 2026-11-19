"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type SignInState } from "./actions";

export function LoginForm({ configured, notice }: { configured: boolean; notice: string | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  const message = state.error ?? notice;
  const isError = state.error !== null;
  return (
    <form action={action} className="flex flex-col gap-3" aria-describedby={message ? "login-message" : undefined}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">이메일</Label>
        <Input id="login-email" name="email" type="email" autoComplete="username" required disabled={!configured} className="h-11" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">비밀번호</Label>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required disabled={!configured} className="h-11" />
      </div>
      {message ? (
        <p id="login-message" role={isError ? "alert" : "status"} className={isError ? "text-xs text-danger" : "text-xs text-amber"}>
          {message}
        </p>
      ) : null}
      <Button type="submit" variant="outline" className="h-11" disabled={!configured || pending}>
        {pending ? "확인 중…" : "관리자 로그인"}
      </Button>
    </form>
  );
}
