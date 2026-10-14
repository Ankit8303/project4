import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { VIDEOS } from "../videos";

const PARAGRAPH =
  "A legal-intelligence engine built on the structure of Indian contract law. ClauseIQ reads every clause and measures its fairness. Every risk becomes measurable, structured, and cited. It continuously reconstructs a contract as a living map of risks and rights. Legal ambiguity is filtered into clear, actionable insight.";

export default function Cinematic() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const smooth = useSpring(scrollYProgress, {
    stiffness: 15,
    damping: 32,
    mass: 1.8,
  });

  const y = useTransform(smooth, [0, 1], [60, -120]);
  const opacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const transform = useMotionTemplate`rotateX(24deg) translateY(${y}px) translateZ(15px)`;

  return (
    <section
      ref={ref}
      className="relative h-screen h-[100dvh] w-full overflow-hidden"
    >
      <video
        src={VIDEOS.cinematic}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Top gradient */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[180px]"
        style={{
          background: "linear-gradient(#010103, transparent)",
        }}
      />

      <div className="relative z-20 flex h-full items-center justify-center">
        <div style={{ perspective: "400px" }} className="max-w-5xl">
          <motion.p
            style={{ transform, opacity }}
            className="select-none px-6 text-center font-sans font-normal leading-[1.35] tracking-[-0.02em] text-white text-[22px] sm:px-12 sm:text-[30px] md:text-[36px] lg:text-[42px]"
          >
            {PARAGRAPH}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
