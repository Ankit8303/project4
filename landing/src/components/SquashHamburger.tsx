import { motion } from "framer-motion";

interface SquashHamburgerProps {
  open: boolean;
  mobile?: boolean;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 20 };

export default function SquashHamburger({
  open,
  mobile = false,
}: SquashHamburgerProps) {
  const w = mobile ? 15 : 18;
  const h = mobile ? 10 : 12;
  const bar = mobile ? 1.2 : 1.5;

  const barBase: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: w,
    height: bar,
    borderRadius: bar,
    background: "#fff",
    marginLeft: -w / 2,
    marginTop: -bar / 2,
  };

  const offset = h / 2;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: w,
        height: h,
      }}
    >
      <motion.span
        style={barBase}
        animate={
          open
            ? { rotate: 45, y: 0 }
            : { rotate: 0, y: -offset }
        }
        transition={spring}
      />
      <motion.span
        style={barBase}
        animate={open ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1 }}
        transition={spring}
      />
      <motion.span
        style={barBase}
        animate={
          open
            ? { rotate: -45, y: 0 }
            : { rotate: 0, y: offset }
        }
        transition={spring}
      />
    </span>
  );
}
