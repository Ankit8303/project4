import ClauseIQLogo from "../components/ClauseIQLogo";
import { VIDEOS } from "../videos";

export default function Footer() {
  return (
    <footer className="flex min-h-[400px] flex-col overflow-hidden bg-black md:flex-row">
      {/* Left video */}
      <div className="h-[300px] w-full md:h-auto md:w-1/2">
        <video
          src={VIDEOS.footer}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        />
      </div>

      {/* Right content */}
      <div className="flex flex-col justify-between p-10 sm:p-16 md:w-1/2">
        <div>
          <div className="mb-8 flex items-center gap-2.5">
            <ClauseIQLogo width={18} height={18} className="text-white/70" fill="currentColor" />
            <span className="text-[15px] font-medium tracking-tight text-white/70">
              ClauseIQ
            </span>
          </div>
          <p className="max-w-sm leading-relaxed text-white/40 text-[14px] sm:text-[15px]">
            Legal clarity for everyone. Built for people who refuse to sign what
            they can't understand.
          </p>
        </div>

        <p className="mt-12 text-white/25 text-[12px]">
          © 2026 ClauseIQ · Decision-support, not legal advice.
        </p>
      </div>
    </footer>
  );
}
