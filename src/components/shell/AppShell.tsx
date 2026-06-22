import { Outlet } from "react-router-dom";
import { BackgroundBoard } from "./BackgroundBoard";
import { FloatingControls } from "./FloatingControls";
import { useAppearance } from "@/hooks/useAppearance";

export function AppShell() {
  useAppearance();
  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundBoard />
      <FloatingControls />
      <main className="relative z-[1] flex-1 px-3 pb-8 pt-5 sm:px-5 md:px-6 lg:px-8 lg:pt-6">
        <div className="mx-auto w-full max-w-[1720px]">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer relative z-[1]">
        <div className="site-footer-inner">Powered by Komari Monitor.</div>
      </footer>
    </div>
  );
}
