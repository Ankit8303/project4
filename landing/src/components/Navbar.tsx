import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ClauseIQLogo from "./ClauseIQLogo";
import ScrambleText from "./ScrambleText";
import SquashHamburger from "./SquashHamburger";

interface NavbarProps {
  entranceComplete: boolean;
}

const NAV_LINKS = [
  { label: "How It Works", target: () => window.innerHeight },
  { label: "Metrics", target: () => window.innerHeight * 2 },
];

const pillSpring = { type: "spring" as const, stiffness: 350, damping: 28 };

function scrollTo(y: number) {
  window.scrollTo({ top: y, behavior: "smooth" });
}

export default function Navbar({ entranceComplete }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: entranceComplete ? 1 : 0 }}
      transition={{ duration: 0.8 }}
      className="fixed top-0 left-0 right-0 z-50 h-20 w-full"
    >
      <div className="flex h-full w-full items-center justify-between px-4 sm:px-6 md:px-8">
        {/* LEFT GROUP */}
        <div className="flex items-center">
          {/* Logo pill — desktop */}
          <motion.div
            whileHover={{
              scale: 1.02,
              backgroundColor: "rgba(255,255,255,0.22)",
            }}
            whileTap={{ scale: 0.98 }}
            className="hidden h-12 items-center gap-2.5 rounded-[14px] bg-white/15 px-5 backdrop-blur-md md:flex"
          >
            <ClauseIQLogo width={18} height={18} fill="#fff" />
            <span className="text-[16px] font-medium tracking-tight text-white">
              ClauseIQ
            </span>
          </motion.div>

          {/* Logo pill — mobile (collapses when menu open) */}
          <motion.div
            animate={{ width: open ? 0 : "auto", opacity: open ? 0 : 1 }}
            transition={pillSpring}
            className="flex overflow-hidden md:hidden"
          >
            <div className="flex h-9 items-center gap-2 rounded-[10px] bg-white/15 px-3.5 backdrop-blur-md">
              <ClauseIQLogo width={15} height={15} fill="#fff" />
              <span className="whitespace-nowrap text-[13px] font-medium tracking-tight text-white">
                ClauseIQ
              </span>
            </div>
          </motion.div>

          {/* Expanding menu pill — desktop */}
          <motion.div
            initial={false}
            animate={{ width: open ? 290 : 48 }}
            transition={pillSpring}
            className="ml-3 hidden h-12 items-center overflow-hidden rounded-[14px] bg-white/15 backdrop-blur-md md:flex"
          >
            <div className={`flex h-full items-center ${open ? "pl-1.5" : ""}`}>
              <motion.button
                onClick={() => setOpen((v) => !v)}
                animate={{
                  width: open ? 36 : 48,
                  height: open ? 36 : 48,
                  borderRadius: open ? 11 : 14,
                }}
                className={`flex items-center justify-center ${
                  open ? "ml-1.5 bg-white/10 hover:bg-white/20" : ""
                }`}
                aria-label="Toggle menu"
              >
                <SquashHamburger open={open} />
              </motion.button>
            </div>
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-5 whitespace-nowrap pl-4 pr-5"
                >
                  {NAV_LINKS.map((link) => (
                    <button
                      key={link.label}
                      onMouseEnter={() => setHovered(link.label)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => {
                        scrollTo(link.target());
                        setOpen(false);
                      }}
                      className="text-[16px] font-normal text-white/85 transition-colors hover:text-white"
                    >
                      <ScrambleText
                        text={link.label}
                        isHovered={hovered === link.label}
                      />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Expanding menu capsule — mobile */}
          <motion.div
            initial={false}
            animate={{ width: open ? "100%" : 36 }}
            transition={pillSpring}
            className="ml-2 flex h-9 items-center overflow-hidden rounded-[10px] bg-white/15 backdrop-blur-md md:hidden"
          >
            <button
              onClick={() => setOpen((v) => !v)}
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${
                open ? "bg-white/10" : ""
              }`}
              aria-label="Toggle menu"
            >
              <SquashHamburger open={open} mobile />
            </button>
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-4 whitespace-nowrap px-3"
                >
                  {NAV_LINKS.map((link) => (
                    <button
                      key={link.label}
                      onClick={() => {
                        scrollTo(link.target());
                        setOpen(false);
                      }}
                      className="text-[13px] font-normal text-white/85 hover:text-white"
                    >
                      {link.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* RIGHT BUTTON */}
        <motion.a
          href="https://clauseiq-app-fawn.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.03, backgroundColor: "#e2e2e6" }}
          whileTap={{ scale: 0.97 }}
          onMouseEnter={() => setHovered("__cta")}
          onMouseLeave={() => setHovered(null)}
          className="flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-black sm:h-12 sm:px-6"
        >
          <i className="bi bi-box-arrow-up-right text-[14px]" />
          <ScrambleText
            text="Open App"
            isHovered={hovered === "__cta"}
            className="text-[13px] font-medium sm:text-[15px]"
          />
        </motion.a>
      </div>
    </motion.nav>
  );
}
