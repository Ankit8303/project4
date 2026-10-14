import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ScrambleIn from "../components/ScrambleIn";
import { VIDEOS } from "../videos";

interface HeroProps {
  entranceComplete: boolean;
}

const SENSITIVITY = 0.8;

export default function Hero({ entranceComplete }: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastX = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const pendingRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.currentTime = 0;

    const applySeek = () => {
      if (!video.duration) return;
      seekingRef.current = true;
      let next = video.currentTime + pendingRef.current;
      pendingRef.current = 0;
      // wrap within duration
      const dur = video.duration;
      next = ((next % dur) + dur) % dur;
      video.currentTime = next;
    };

    const onSeeked = () => {
      if (pendingRef.current !== 0) {
        applySeek();
      } else {
        seekingRef.current = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (lastX.current === null) {
        lastX.current = e.clientX;
        return;
      }
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      pendingRef.current += (delta / window.innerWidth) * video.duration * SENSITIVITY;
      if (!seekingRef.current) {
        applySeek();
      }
    };

    video.addEventListener("seeked", onSeeked);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      video.removeEventListener("seeked", onSeeked);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <section className="relative h-screen h-[100dvh] w-full overflow-hidden">
      <video
        ref={videoRef}
        src={VIDEOS.hero}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Dot-grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.05,
        }}
      />

      {/* Watermark */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 w-full select-none text-center uppercase"
        style={{
          transform: "translate(-50%, calc(-50% + 50px))",
          fontFamily: '"Anton SC", sans-serif',
          fontSize: "clamp(120px, 30vw, 521px)",
          letterSpacing: "-4px",
          lineHeight: 1,
          opacity: 0.1,
          backgroundImage:
            "radial-gradient(circle, rgba(142,127,148,0) 0%, #8E7F94 70%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        JURISPRUDENCE
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: entranceComplete ? 1 : 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 flex h-full flex-col px-4 pb-8 pt-20 sm:px-6 sm:pb-12 sm:pt-24 md:px-8"
      >
        <div className="flex-1" />

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            <h1 className="font-light leading-[0.95] tracking-[-0.03em] text-white text-[clamp(40px,10vw,100px)]">
              <ScrambleIn text="Every" delay={200} triggered={entranceComplete} />
              <br />
              <ScrambleIn text="Clause" delay={500} triggered={entranceComplete} />
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 25 }}
              animate={
                entranceComplete
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 25 }
              }
              transition={{
                duration: 0.9,
                ease: [0.215, 0.61, 0.355, 1.0],
                delay: 0.2,
              }}
              className="max-w-sm leading-relaxed text-white/60 text-[13px] sm:text-[15px]"
            >
              Built at the intersection of law and machine intelligence. ClauseIQ
              reads Indian contracts, flags the clauses that are unfair to you with
              a severity score, and grounds every finding in the exact section of
              Indian law.
            </motion.p>
          </div>

          {/* Right column */}
          <h1 className="text-left font-light leading-[0.95] tracking-[-0.03em] text-white text-[clamp(40px,10vw,100px)] md:text-right">
            <ScrambleIn text="Cited to" delay={700} triggered={entranceComplete} />
            <br />
            <ScrambleIn
              text="The Law"
              delay={1000}
              triggered={entranceComplete}
            />
          </h1>
        </div>
      </motion.div>
    </section>
  );
}
