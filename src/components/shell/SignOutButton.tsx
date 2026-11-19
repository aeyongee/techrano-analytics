import { LogOut } from "lucide-react";

/** 로그아웃은 POST로만 받는다(링크로 로그아웃시키는 장난을 막는다). */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="inline-flex h-9 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <LogOut className="size-3.5" aria-hidden />
        로그아웃
      </button>
    </form>
  );
}
