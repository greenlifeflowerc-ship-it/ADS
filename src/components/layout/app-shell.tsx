"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, Settings, Sparkles, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveProfileProvider, type ActiveProfileValue } from "@/lib/context/active-profile";
import { signOutAction } from "@/server/actions/auth";
import { ProfileSwitcher } from "./profile-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profiles", label: "Profiles", icon: User },
  { href: "/winning-ads", label: "Winning Ads", icon: Trophy },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="font-semibold">Ads Maker</span>
      </div>

      <ProfileSwitcher />
      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-md border p-2">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">
                {email?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
          <ThemeToggle />
        </div>
        <form action={signOutAction}>
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  profiles,
  activeProfileId,
  children,
}: {
  user: { email: string };
  profiles: ActiveProfileValue["profiles"];
  activeProfileId: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ActiveProfileProvider value={{ activeProfileId, profiles }}>
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:block">
          <div className="sticky top-0 h-screen">
            <SidebarBody email={user.email} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b p-3 md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarBody email={user.email} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold">Ads Maker</span>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </ActiveProfileProvider>
  );
}
