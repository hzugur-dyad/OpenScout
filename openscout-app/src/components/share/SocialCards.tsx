"use client";

type BaseCardProps = {
  className?: string;
};

type MetalTheme = {
  shell: string;
  overlay: string;
  vignette: string;
  streak: string;
  text: string;
  muted: string;
  chip: string;
  brand: string;
};

function firstNameOnly(value: string | undefined) {
  return (value ?? "").trim().split(/\s+/).filter(Boolean)[0] ?? "";
}

function metallicThemeByScore(score: number): MetalTheme {
  if (score >= 90) {
    return {
      shell:
        "border-[#A3B45D]/52 bg-[linear-gradient(158deg,#2f3814_0%,#55661f_18%,#7f8f28_44%,#9CB04A_60%,#6E7F24_78%,#313A14_100%)] shadow-[0_28px_66px_-30px_rgba(28,36,11,0.75)]",
      overlay:
        "before:bg-[radial-gradient(120%_85%_at_18%_10%,rgba(248,255,226,0.30),transparent_52%),radial-gradient(90%_70%_at_72%_18%,rgba(250,255,230,0.16),transparent_56%),radial-gradient(80%_70%_at_80%_86%,rgba(25,35,8,0.24),transparent_66%)]",
      vignette: "after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10),inset_0_-26px_56px_rgba(0,0,0,0.22),inset_0_22px_44px_rgba(255,255,255,0.07)]",
      streak: "bg-[linear-gradient(102deg,transparent_16%,rgba(255,255,255,0.16)_45%,rgba(255,255,255,0.08)_53%,transparent_72%)]",
      text: "text-[#F6F8EA]",
      muted: "text-[#E6EBC7]",
      chip: "border-[#C9D69B]/45 bg-[#DDE7B9]/16 text-[#F3F7DD]",
      brand: "text-[#DDE7B9]",
    };
  }
  if (score >= 70) {
    return {
      shell:
        "border-zinc-300/58 bg-[linear-gradient(158deg,#4E545D_0%,#7D848E_22%,#BBC2CC_44%,#E0E4EA_58%,#9DA5B0_78%,#464C54_100%)] shadow-[0_28px_66px_-30px_rgba(20,24,31,0.66)]",
      overlay:
        "before:bg-[radial-gradient(120%_85%_at_18%_10%,rgba(255,255,255,0.42),transparent_52%),radial-gradient(90%_70%_at_72%_18%,rgba(255,255,255,0.18),transparent_56%),radial-gradient(80%_70%_at_80%_86%,rgba(20,24,31,0.2),transparent_66%)]",
      vignette: "after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),inset_0_-26px_56px_rgba(0,0,0,0.18),inset_0_22px_44px_rgba(255,255,255,0.10)]",
      streak: "bg-[linear-gradient(102deg,transparent_16%,rgba(255,255,255,0.20)_45%,rgba(255,255,255,0.10)_53%,transparent_72%)]",
      text: "text-[#101114]",
      muted: "text-[#2A2D33]",
      chip: "border-zinc-600/22 bg-white/42 text-[#1A1D22]",
      brand: "text-[#1D2026]",
    };
  }
  if (score >= 50) {
    return {
      shell:
        "border-[#B88B68]/56 bg-[linear-gradient(158deg,#3D261D_0%,#704632_20%,#A8704D_44%,#CD986A_58%,#89593F_78%,#3A241C_100%)] shadow-[0_28px_66px_-30px_rgba(55,29,20,0.7)]",
      overlay:
        "before:bg-[radial-gradient(120%_85%_at_18%_10%,rgba(255,236,218,0.28),transparent_52%),radial-gradient(90%_70%_at_72%_18%,rgba(255,238,222,0.14),transparent_56%),radial-gradient(80%_70%_at_80%_86%,rgba(36,18,12,0.22),transparent_66%)]",
      vignette: "after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10),inset_0_-26px_56px_rgba(0,0,0,0.2),inset_0_22px_44px_rgba(255,255,255,0.07)]",
      streak: "bg-[linear-gradient(102deg,transparent_16%,rgba(255,232,214,0.14)_45%,rgba(255,235,220,0.07)_53%,transparent_72%)]",
      text: "text-[#F8EBDD]",
      muted: "text-[#F2D9C3]",
      chip: "border-[#E4B88F]/34 bg-[#FFE8D1]/10 text-[#F7DFC9]",
      brand: "text-[#F0D2B7]",
    };
  }
  return {
    shell:
      "border-zinc-600/52 bg-[linear-gradient(158deg,#08090B_0%,#1A1E24_20%,#323840_44%,#4B535D_58%,#262C34_78%,#07080A_100%)] shadow-[0_28px_66px_-30px_rgba(0,0,0,0.84)]",
    overlay:
      "before:bg-[radial-gradient(120%_85%_at_18%_10%,rgba(255,255,255,0.20),transparent_52%),radial-gradient(90%_70%_at_72%_18%,rgba(255,255,255,0.08),transparent_56%),radial-gradient(80%_70%_at_80%_86%,rgba(0,0,0,0.3),transparent_66%)]",
    vignette: "after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_-26px_56px_rgba(0,0,0,0.3),inset_0_22px_44px_rgba(255,255,255,0.05)]",
    streak: "bg-[linear-gradient(102deg,transparent_18%,rgba(255,255,255,0.10)_46%,rgba(255,255,255,0.04)_54%,transparent_74%)]",
    text: "text-zinc-100",
    muted: "text-zinc-300",
    chip: "border-zinc-400/25 bg-zinc-100/8 text-zinc-200",
    brand: "text-zinc-300",
  };
}

function cardShellClassName(score: number, extra?: string) {
  const theme = metallicThemeByScore(score);
  return [
    "relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[24px] border px-7 py-8",
    "aspect-[4/5]",
    "before:pointer-events-none before:absolute before:inset-0",
    "after:pointer-events-none after:absolute after:inset-0 after:rounded-[24px]",
    theme.shell,
    theme.overlay,
    theme.vignette,
    extra ?? "",
  ].join(" ");
}

function Branding({ className }: { className: string }) {
  return (
    <div className={`mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] ${className}`}>
      <span>OpenScout</span>
      <span>AI Readiness</span>
    </div>
  );
}

export function InterviewResultCard({
  role,
  score,
  evaluationLine,
  firstName: rawFirstName,
  className,
}: BaseCardProps & {
  role: string;
  score: number;
  evaluationLine: string;
  firstName?: string;
}) {
  const theme = metallicThemeByScore(score);
  const firstName = firstNameOnly(rawFirstName);
  return (
    <article className={cardShellClassName(score, className)}>
      <span
        aria-hidden
        className={`pointer-events-none absolute -left-[26%] -top-[22%] h-[78%] w-[160%] rotate-[14deg] blur-[16px] opacity-60 ${theme.streak}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute left-[46%] top-[50%] -translate-x-1/2 -translate-y-1/2 font-semibold leading-none tracking-[-0.08em] ${theme.text} opacity-[0.055] text-[520px] blur-[1.5px]`}
      >
        S
      </span>
      <div className="relative z-10 flex h-full flex-col">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.muted}`}>
            Interview Result
          </p>
          <h3 className={`mt-2 text-2xl font-semibold leading-tight tracking-tight ${theme.text}`}>{role}</h3>
          {firstName && <p className={`mt-2 text-sm font-medium ${theme.muted}`}>{firstName}</p>}
        </div>
        <div className="mt-auto text-center">
          <p className={`font-mono text-[118px] font-semibold leading-none tabular-nums tracking-[-0.04em] ${theme.text}`}>
            {score}
          </p>
        </div>
        <div className="mt-auto">
          <p className={`text-center text-sm ${theme.muted}`}>{evaluationLine}</p>
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.chip}`}>
              High Readiness
            </span>
          </div>
          <Branding className={theme.brand} />
        </div>
      </div>
    </article>
  );
}

export function CvAnalysisCard({
  role,
  score,
  insightLine,
  firstName: rawFirstName,
  className,
}: BaseCardProps & {
  role: string;
  score: number;
  insightLine: string;
  firstName?: string;
}) {
  const theme = metallicThemeByScore(score);
  const firstName = firstNameOnly(rawFirstName);
  return (
    <article className={cardShellClassName(score, className)}>
      <span
        aria-hidden
        className={`pointer-events-none absolute -left-[26%] -top-[22%] h-[78%] w-[160%] rotate-[14deg] blur-[16px] opacity-60 ${theme.streak}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute left-[46%] top-[50%] -translate-x-1/2 -translate-y-1/2 font-semibold leading-none tracking-[-0.08em] ${theme.text} opacity-[0.055] text-[520px] blur-[1.5px]`}
      >
        S
      </span>
      <div className="relative z-10 flex h-full flex-col">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.muted}`}>
            CV Analysis
          </p>
          <h3 className={`mt-2 text-2xl font-semibold leading-tight tracking-tight ${theme.text}`}>{role}</h3>
          {firstName && <p className={`mt-2 text-sm font-medium ${theme.muted}`}>{firstName}</p>}
        </div>
        <div className="mt-auto text-center">
          <p className={`font-mono text-[118px] font-semibold leading-none tabular-nums tracking-[-0.04em] ${theme.text}`}>
            {score}
          </p>
        </div>
        <div className="mt-auto">
          <p className={`text-center text-sm ${theme.muted}`}>{insightLine}</p>
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.chip}`}>
              Strong Profile
            </span>
          </div>
          <Branding className={theme.brand} />
        </div>
      </div>
    </article>
  );
}

export function ProfileCard({
  name,
  bestScore,
  skills,
  className,
}: BaseCardProps & {
  name: string;
  bestScore: number;
  skills: string[];
}) {
  const theme = metallicThemeByScore(bestScore);
  const firstName = firstNameOnly(name);
  return (
    <article className={cardShellClassName(bestScore, className)}>
      <span
        aria-hidden
        className={`pointer-events-none absolute -left-[26%] -top-[22%] h-[78%] w-[160%] rotate-[14deg] blur-[16px] opacity-60 ${theme.streak}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute left-[46%] top-[50%] -translate-x-1/2 -translate-y-1/2 font-semibold leading-none tracking-[-0.08em] ${theme.text} opacity-[0.055] text-[520px] blur-[1.5px]`}
      >
        S
      </span>
      <div className="relative z-10 flex h-full flex-col">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.muted}`}>
            Candidate Profile
          </p>
          <h3 className={`mt-2 text-2xl font-semibold leading-tight tracking-tight ${theme.text}`}>{firstName || "Candidate"}</h3>
        </div>
        <div className="mt-auto text-center">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${theme.muted}`}>
            Best Scout Score
          </p>
          <p className={`mt-2 font-mono text-[104px] font-semibold leading-none tabular-nums tracking-[-0.04em] ${theme.text}`}>
            {bestScore}
          </p>
        </div>
        <div className="mt-auto">
          <ul className="flex flex-wrap justify-center gap-2">
            {skills.slice(0, 3).map((skill) => (
              <li
                key={skill}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${theme.chip}`}
              >
                {skill}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-center">
            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${theme.chip}`}>
              Top Candidate
            </span>
          </div>
          <Branding className={theme.brand} />
        </div>
      </div>
    </article>
  );
}
