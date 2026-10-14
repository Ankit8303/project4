import { useEffect, useState } from "react";

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><";

const randomChar = () => CHARSET[Math.floor(Math.random() * CHARSET.length)];

interface ScrambleTextProps {
  text: string;
  isHovered: boolean;
  className?: string;
}

export default function ScrambleText({
  text,
  isHovered,
  className,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (!isHovered) {
      setDisplay(text);
      return;
    }

    let frame = 0;
    const interval = window.setInterval(() => {
      frame += 1;
      // reveal one char every 4 frames, left-to-right
      const revealed = Math.floor(frame / 4);

      let out = "";
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === " ") {
          out += " ";
        } else if (i < revealed) {
          out += char;
        } else {
          out += randomChar();
        }
      }
      setDisplay(out);

      if (revealed >= text.length) {
        window.clearInterval(interval);
        setDisplay(text);
      }
    }, 25);

    return () => window.clearInterval(interval);
  }, [isHovered, text]);

  return <span className={className}>{display}</span>;
}
