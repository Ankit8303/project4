import { motion } from "framer-motion";
import { VIDEOS } from "../videos";

const TILES = [
  {
    title: "Clause Segmentation",
    desc: "Splits the contract into individual, analysable clauses.",
  },
  {
    title: "Hybrid Retrieval",
    desc: "Finds the relevant law via combined vector and keyword search.",
  },
  {
    title: "Risk Scoring",
    desc: "Rates each clause 1–5 for unfairness, with a plain-language rationale.",
  },
  {
    title: "Citation Verify",
    desc: "Drops any citation that isn't grounded in real statute.",
  },
];

export default function Technology() {
  return (
    <section className="relative h-screen h-[100dvh] w-full overflow-hidden">
      <video
        src={VIDEOS.technology}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative z-10 flex h-full flex-col px-8 py-12 sm:px-12 sm:py-16 md:px-16">
        {/* Top */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.0 }}
            className="font-light leading-[0.95] tracking-[-0.03em] text-white text-[clamp(36px,8vw,72px)]"
          >
            Multi-Agent
            <br />
            Analysis
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.0, delay: 0.2 }}
            className="max-w-xs leading-relaxed text-white/50 text-[13px] sm:text-[15px] md:pt-2 md:text-right"
          >
            ClauseIQ reads your contract clause by clause, retrieves the relevant
            law, scores each risk, and verifies every citation — so nothing is
            hallucinated.
          </motion.p>
        </div>

        <div className="flex-1" />

        {/* Bottom grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.0, delay: 0.3 }}
          className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6"
        >
          {TILES.map((tile, i) => (
            <motion.div
              key={tile.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
            >
              <h3 className="mb-2 font-normal text-white text-[14px] sm:text-[16px]">
                {tile.title}
              </h3>
              <p className="leading-relaxed text-white/40 text-[12px] sm:text-[14px]">
                {tile.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
