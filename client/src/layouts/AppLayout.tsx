import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookMarked,
  ChartColumn,
  Home,
  LogOut,
  MessageCircle,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-sea text-white"
      : "bg-white/70 text-ink-soft hover:bg-white hover:text-ink"
  }`;

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const isChat = location.pathname.startsWith("/chat");

  return (
    <div className="min-h-screen">
      <header className="border-b border-mist/80 bg-white/70 backdrop-blur">
        <div
          className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 ${
            isChat ? "max-w-none" : "max-w-6xl"
          }`}
        >
          <div>
            <p className="font-display text-2xl font-bold text-ink">PolyGlot AI</p>
            <p className="text-xs text-ink-soft">Learn with Polly</p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/home" className={linkClass}>
              <Home className="h-4 w-4" />
              Home
            </NavLink>
            <NavLink to="/chat" className={linkClass}>
              <MessageCircle className="h-4 w-4" />
              Chat
            </NavLink>
            <NavLink to="/dictionary" className={linkClass}>
              <BookMarked className="h-4 w-4" />
              Dictionary
            </NavLink>
            <NavLink to="/quiz" className={linkClass}>
              <Sparkles className="h-4 w-4" />
              Quiz
            </NavLink>
            <NavLink to="/progress" className={linkClass}>
              <ChartColumn className="h-4 w-4" />
              Progress
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              <Settings className="h-4 w-4" />
              Settings
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-sm text-ink-soft lg:flex">
              <UserRound className="h-4 w-4" />
              {user?.name}
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-full border border-mist bg-white px-3 py-2 text-sm text-ink-soft hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main
        className={
          isChat
            ? "px-3 pb-0 pt-3"
            : "mx-auto max-w-6xl px-4 py-6"
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
