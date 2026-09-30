import type { CSSProperties } from "react";
import styled, { keyframes } from "styled-components";

export type ConfettiPieceStyle = CSSProperties & Record<`--confetti-${string}`, string>;
export type ConfettiOrigin = { x: number; y: number };
export type ConfettiBurst = { id: number; pieces: ConfettiPieceStyle[] };
export type FireworkStyle = CSSProperties & Record<`--firework-${string}`, string>;
export type FireworkOrigin = ConfettiOrigin & { delay: number };
export type FireworkBurst = { id: number; ring: FireworkStyle; sparks: FireworkStyle[] };

const CONFETTI_COLORS = ["#58cc02", "#ff4b4b", "#ffc800", "#1cb0f6", "#ce82ff", "#ff9600"];
const FIREWORK_COLORS = ["#4f63ff", "#8b5cf6", "#1cb0f6", "#ffc800", "#ff70c8", "#58cc02"];

export function createConfettiPieces(origin: ConfettiOrigin, count = 28): ConfettiPieceStyle[] {
  return Array.from({ length: count }, () => {
    const angle = (-165 + Math.random() * 150) * (Math.PI / 180);
    const launchDistance = 6 + Math.random() * 10;
    const midX = Math.cos(angle) * launchDistance;
    const midY = Math.sin(angle) * launchDistance;
    const endX = midX + (Math.random() - 0.5) * 8;
    const endY = midY + 12 + Math.random() * 9;
    const spinDirection = Math.random() > 0.5 ? 1 : -1;
    const endSpin = spinDirection * (420 + Math.random() * 600);
    const isRound = Math.random() > 0.72;
    const isWide = !isRound && Math.random() > 0.58;
    const width = isRound ? 0.48 + Math.random() * 0.24 : isWide ? 0.65 + Math.random() * 0.34 : 0.38 + Math.random() * 0.24;
    const height = isRound ? width : isWide ? 0.3 + Math.random() * 0.2 : 0.7 + Math.random() * 0.45;

    return {
      "--confetti-mid-x": `${midX.toFixed(2)}rem`,
      "--confetti-mid-y": `${midY.toFixed(2)}rem`,
      "--confetti-end-x": `${endX.toFixed(2)}rem`,
      "--confetti-end-y": `${endY.toFixed(2)}rem`,
      "--confetti-mid-spin": `${(endSpin * 0.38).toFixed(0)}deg`,
      "--confetti-end-spin": `${endSpin.toFixed(0)}deg`,
      "--confetti-duration": `${Math.round(1250 + Math.random() * 550)}ms`,
      "--confetti-delay": `${Math.round(Math.random() * 120)}ms`,
      "--confetti-color": CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      "--confetti-left": `${(origin.x + (Math.random() - 0.5) * 12).toFixed(1)}px`,
      "--confetti-top": `${(origin.y + (Math.random() - 0.5) * 8).toFixed(1)}px`,
      "--confetti-width": `${width.toFixed(2)}rem`,
      "--confetti-height": `${height.toFixed(2)}rem`,
      "--confetti-radius": isRound ? "999px" : `${(0.08 + Math.random() * 0.18).toFixed(2)}rem`,
    };
  });
}

export function createFireworkRing(origin: FireworkOrigin, index: number): FireworkStyle {
  const color = FIREWORK_COLORS[index % FIREWORK_COLORS.length];

  return {
    "--firework-left": `${origin.x.toFixed(1)}px`,
    "--firework-top": `${origin.y.toFixed(1)}px`,
    "--firework-color": color,
    "--firework-delay": `${origin.delay}ms`,
    "--firework-duration": `${Math.round(920 + Math.random() * 260)}ms`,
    "--firework-size": `${(5.4 + Math.random() * 2.8).toFixed(2)}rem`,
  };
}

export function createFireworkSparks(origin: FireworkOrigin, count = 26): FireworkStyle[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.34;
    const distance = 4.6 + Math.random() * 7.4;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;
    const driftX = endX + (Math.random() - 0.5) * 2.6;
    const driftY = endY + 1.1 + Math.random() * 2.8;
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const size = 0.3 + Math.random() * 0.28;

    return {
      "--firework-left": `${(origin.x + (Math.random() - 0.5) * 8).toFixed(1)}px`,
      "--firework-top": `${(origin.y + (Math.random() - 0.5) * 8).toFixed(1)}px`,
      "--firework-end-x": `${endX.toFixed(2)}rem`,
      "--firework-end-y": `${endY.toFixed(2)}rem`,
      "--firework-drift-x": `${driftX.toFixed(2)}rem`,
      "--firework-drift-y": `${driftY.toFixed(2)}rem`,
      "--firework-color": color,
      "--firework-delay": `${Math.round(origin.delay + Math.random() * 150)}ms`,
      "--firework-duration": `${Math.round(980 + Math.random() * 520)}ms`,
      "--firework-size": `${size.toFixed(2)}rem`,
    };
  });
}

const confettiBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
    animation-timing-function: cubic-bezier(0.12, 0.72, 0.28, 1);
  }
  10% {
    opacity: 1;
  }
  42% {
    opacity: 1;
    transform:
      translate(
        calc(-50% + var(--confetti-mid-x)),
        calc(-50% + var(--confetti-mid-y))
      )
      scale(1)
      rotate(var(--confetti-mid-spin));
    animation-timing-function: cubic-bezier(0.38, 0, 0.72, 0.42);
  }
  76% {
    opacity: 0.92;
  }
  100% {
    opacity: 0;
    transform:
      translate(
        calc(-50% + var(--confetti-end-x)),
        calc(-50% + var(--confetti-end-y))
      )
      scale(0.78)
      rotate(var(--confetti-end-spin));
  }
`;

const fireworkRingBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.08);
  }
  14% {
    opacity: 0.95;
  }
  72% {
    opacity: 0.45;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }
`;

const fireworkSparkBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.22);
  }
  10% {
    opacity: 1;
  }
  62% {
    opacity: 0.96;
    transform:
      translate(
        calc(-50% + var(--firework-end-x)),
        calc(-50% + var(--firework-end-y))
      )
      scale(1);
  }
  100% {
    opacity: 0;
    transform:
      translate(
        calc(-50% + var(--firework-drift-x)),
        calc(-50% + var(--firework-drift-y))
      )
      scale(0.16);
  }
`;

export const QuizConfetti = styled.span`
  position: fixed;
  z-index: 9999;
  inset: 0;
  overflow: hidden;
  pointer-events: none;

  span {
    position: absolute;
    top: var(--confetti-top);
    left: var(--confetti-left);
    width: var(--confetti-width);
    height: var(--confetti-height);
    border-radius: var(--confetti-radius);
    background: var(--confetti-color);
    box-shadow: 0 2px 5px rgba(30, 41, 59, 0.12);
    animation: ${confettiBurst} var(--confetti-duration) var(--confetti-delay) both;
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

export const CompletionFireworks = styled.span`
  position: fixed;
  z-index: 10000;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  mix-blend-mode: screen;

  .firework-ring,
  .firework-spark {
    position: absolute;
    top: var(--firework-top);
    left: var(--firework-left);
    will-change: transform, opacity;
  }

  .firework-ring {
    width: var(--firework-size);
    height: var(--firework-size);
    border-radius: 999px;
    border: 2px solid var(--firework-color);
    box-shadow:
      0 0 18px var(--firework-color),
      inset 0 0 16px color-mix(in srgb, var(--firework-color) 72%, transparent);
    animation: ${fireworkRingBurst} var(--firework-duration) var(--firework-delay) both;
  }

  .firework-spark {
    width: var(--firework-size);
    height: var(--firework-size);
    border-radius: 999px;
    background: var(--firework-color);
    box-shadow:
      0 0 10px var(--firework-color),
      0 0 22px color-mix(in srgb, var(--firework-color) 78%, transparent);
    animation: ${fireworkSparkBurst} var(--firework-duration) var(--firework-delay) both;
  }

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

