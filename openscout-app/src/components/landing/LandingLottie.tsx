"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Lottie = dynamic(
  () => import("lottie-react").then((mod) => mod.default),
  { ssr: false }
);

const DEFAULT_ANIMATION_PATH = "/animations/landing-scene.json";
const DEFAULT_WRAPPER_CLASS =
  "shrink-0 w-full max-w-[200px] sm:max-w-[240px] lg:max-w-[260px]";

type LandingLottieProps = {
  animationPath?: string;
  wrapperClassName?: string;
  loop?: boolean;
};

export function LandingLottie({
  animationPath = DEFAULT_ANIMATION_PATH,
  wrapperClassName = DEFAULT_WRAPPER_CLASS,
  loop = true,
}: LandingLottieProps = {}) {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch(animationPath)
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(() => {});
  }, [animationPath]);

  if (!animationData) return null;

  return (
    <div className={wrapperClassName} aria-hidden>
      <Lottie
        animationData={animationData}
        loop={loop}
        className="w-full h-auto"
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
}
