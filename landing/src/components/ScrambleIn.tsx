import { useEffect, useState } from "react";

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><";

const randomChar = () => CHARSET[Math.floor(Math.random() * CHARSET.length)];

interface ScrambleInProps {
  text: string;
  delay: number;
  triggered: boolean;
}

export default function ScrambleIn({ text, delay, triggered }: ScrambleInProps) {
  const [display, setDisplay] = useState<string>("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!triggered) return;

    let interval = 0;
    let reveal = 0;

    const startTimeout = window.setTimeout(() => {
      setStarted(true);
      reveal = 0;

      interval = window.setInterval(() => {
        reveal += 0.5;
        const revealed = Math.floor(reveal);

        let out = "";
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === " ") {
            out += " ";
          } else if (i < revealed) {
            out += char;
          } else if (i < revealed + 3) {
            out += randomChar();
          }
        }
        setDisplay(out);

        if (revealed >= text.length) {
          window.clearInterval(interval);
          setDisplay(text);
        }
      }, 25);
    }, delay);

    return () => {
      window.clearTimeout(startTimeout);
      window.clearInterval(interval);
    };
  }, [triggered, delay, text]);

  if (!triggered || !started) {
    return <>&nbsp;</>;
  }

  return <>{display}</>;
}
