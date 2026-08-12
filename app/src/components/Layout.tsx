import { Link, Outlet } from "@tanstack/react-router";
import { ArrowUp, Database, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfig } from "@/contexts/ConfigContext";
import { useProfileId } from "@/hooks/useProfileApi";
import { activeProfile } from "@/types/config";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { Button } from "./ui/button";

export function Layout() {
  const { config, isLoading } = useConfig();
  const profile = useProfileId();
  const services = activeProfile(config, profile);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <div className="mr-8 font-bold text-xl">S3 & SQS UI</div>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {services?.s3 && (
              <Link to="/$profile/s3" params={{ profile }} className="flex items-center gap-2 hover:text-primary">
                <Database className="h-4 w-4" />
                S3
              </Link>
            )}
            {services?.sqs && (
              <Link to="/$profile/sqs" params={{ profile }} className="flex items-center gap-2 hover:text-primary">
                <MessageSquare className="h-4 w-4" />
                SQS
              </Link>
            )}
          </nav>
          <ProfileSwitcher />
        </div>
      </header>
      <main className="flex-1 container py-6">
        <Outlet />
      </main>
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-8 right-8 rounded-full shadow-lg z-50 animate-in fade-in duration-200"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
