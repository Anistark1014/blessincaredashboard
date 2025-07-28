import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { NavLink } from "react-router-dom";
import ToggleTheme from "./ToggleTheme";

import { Outlet } from "react-router-dom";

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-lavender/5 to-blush/5">
      {/* Top Navigation */}
      <nav className="bg-card/80 backdrop-blur-sm border-b border-lavender/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-lavender to-blush rounded-full flex items-center justify-center shadow-[var(--shadow-soft)]">
                <Heart className="w-5 h-5 text-lavender-foreground" />
              </div>
              <div>
                <h1 className="text-sm md:text-lg font-semibold text-foreground">Blessin Care</h1>
                <p className="text-xs text-muted-foreground">Welcome to our store</p>
              </div>
            </div>
              <ToggleTheme />

          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default PublicLayout;
