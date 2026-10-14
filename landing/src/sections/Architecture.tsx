import { motion } from "framer-motion";

const LAYERS = [
  { layer: "Layer 1", name: "Retrieve" },
  { layer: "Layer 2", name: "Analyse" },
  { layer: "Layer 3", name: "Verify" },
];

export default function Architecture() {
  return (
    <section className="relative min-h-screen w-full bg-black">
      <div className="mx-auto max-w-3xl px-6 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.0 }}
        >
          <p className="mb-8 uppercase tracking-[0.2em] text-white/40 text-[13px] sm:text-[14px]">
            Architecture
          </p>
          <h2 className="mb-10 font-light leading-[1.15] tracking-[-0.02em] text-white text-[clamp(28px,6vw,56px)]">
            Grounded. Never guessed.
          </h2>
          <p className="mx-auto max-w-xl leading-relaxed text-white/45 text-[15px] sm:text-[17px]">
            A retrieval layer finds the relevant law. An analysis layer scores each
            clause. A verification layer confirms every citation points to a real
            section of statute.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.2, delay: 0.4 }}
          className="mt-20 flex flex-col items-center gap-4"
        >
          {LAYERS.map((l) => (
            <div
              key={l.layer}
              className="flex h-[72px] w-full max-w-md items-center justify-between rounded-lg border border-white/10 px-6"
            >
              <span className="uppercase tracking-[0.15em] text-white/30 text-[12px]">
                {l.layer}
              </span>
              <span className="font-light text-white text-[16px] sm:text-[18px]">
                {l.name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
