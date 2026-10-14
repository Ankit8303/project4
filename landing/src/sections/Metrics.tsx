import { motion } from "framer-motion";
import { VIDEOS } from "../videos";

const METRICS = [
  { value: "100%", label: "Verified Citations" },
  { value: "0.90", label: "Faithfulness Score" },
  { value: "1872", label: "Indian Contract Act" },
];

export default function Metrics() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <video
        src={VIDEOS.metrics}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-32 pt-32">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.2 }}
          className="mb-20 text-center uppercase tracking-[0.2em] text-white/40 text-[13px] sm:text-[14px]"
        >
          By The Numbers
        </motion.p>

        <div className="grid grid-cols-1 gap-16 md:grid-cols-3 md:gap-8">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
              className="text-center md:text-left"
            >
              <div className="font-light leading-none tracking-[-0.04em] text-white text-[clamp(48px,10vw,96px)]">
                {m.value}
              </div>
              <div className="mt-4 tracking-wide text-white/40 text-[13px] sm:text-[15px]">
                {m.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
