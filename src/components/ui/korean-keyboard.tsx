"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import styled, { keyframes } from "styled-components";

export type KoreanKeyboardAction = "backspace" | "space" | string;

const keyboardRows = [
  ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
  ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
  ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"],
] as const;

const doubleKeys = ["ㅃ", "ㅉ", "ㄸ", "ㄲ", "ㅆ", "ㅒ", "ㅖ"] as const;
const initials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;
const vowels = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"] as const;
const finals = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;

const vowelCombinations: Record<string, string> = {
  "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ", "ㅘㅣ": "ㅙ",
  "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅝㅣ": "ㅞ", "ㅡㅣ": "ㅢ",
};
const vowelSplits: Record<string, [string, string]> = {
  "ㅘ": ["ㅗ", "ㅏ"], "ㅙ": ["ㅘ", "ㅣ"], "ㅚ": ["ㅗ", "ㅣ"],
  "ㅝ": ["ㅜ", "ㅓ"], "ㅞ": ["ㅝ", "ㅣ"], "ㅟ": ["ㅜ", "ㅣ"], "ㅢ": ["ㅡ", "ㅣ"],
};
const finalCombinations: Record<string, string> = {
  "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ",
  "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ",
};
const finalSplits: Record<string, [string, string]> = {
  "ㄳ": ["ㄱ", "ㅅ"], "ㄵ": ["ㄴ", "ㅈ"], "ㄶ": ["ㄴ", "ㅎ"], "ㄺ": ["ㄹ", "ㄱ"],
  "ㄻ": ["ㄹ", "ㅁ"], "ㄼ": ["ㄹ", "ㅂ"], "ㄽ": ["ㄹ", "ㅅ"], "ㄾ": ["ㄹ", "ㅌ"],
  "ㄿ": ["ㄹ", "ㅍ"], "ㅀ": ["ㄹ", "ㅎ"], "ㅄ": ["ㅂ", "ㅅ"],
};

function getSyllableParts(character: string) {
  const syllableIndex = character.charCodeAt(0) - 0xac00;
  if (syllableIndex < 0 || syllableIndex > 0xd7a3 - 0xac00) return null;
  return {
    initialIndex: Math.floor(syllableIndex / 588),
    vowelIndex: Math.floor((syllableIndex % 588) / 28),
    finalIndex: syllableIndex % 28,
  };
}

function composeSyllable(initialIndex: number, vowelIndex: number, finalIndex = 0) {
  return String.fromCharCode(0xac00 + initialIndex * 588 + vowelIndex * 28 + finalIndex);
}

export function appendHangulInput(value: string, input: string) {
  if (!value) return input;
  const prefix = value.slice(0, -1);
  const lastCharacter = value.slice(-1);
  const syllable = getSyllableParts(lastCharacter);
  const inputVowelIndex = vowels.indexOf(input as (typeof vowels)[number]);
  const inputFinalIndex = finals.indexOf(input as (typeof finals)[number]);

  if (inputVowelIndex >= 0) {
    if (syllable) {
      if (syllable.finalIndex === 0) {
        const combined = vowelCombinations[`${vowels[syllable.vowelIndex]}${input}`];
        const combinedIndex = combined ? vowels.indexOf(combined as (typeof vowels)[number]) : -1;
        return combinedIndex >= 0 ? `${prefix}${composeSyllable(syllable.initialIndex, combinedIndex)}` : `${value}${input}`;
      }

      const currentFinal = finals[syllable.finalIndex];
      const split = finalSplits[currentFinal];
      const remainingFinal = split?.[0] ?? "";
      const movingInitial = split?.[1] ?? currentFinal;
      const movingInitialIndex = initials.indexOf(movingInitial as (typeof initials)[number]);
      const remainingFinalIndex = finals.indexOf(remainingFinal as (typeof finals)[number]);
      const previous = composeSyllable(syllable.initialIndex, syllable.vowelIndex, Math.max(0, remainingFinalIndex));
      return movingInitialIndex >= 0
        ? `${prefix}${previous}${composeSyllable(movingInitialIndex, inputVowelIndex)}`
        : `${prefix}${previous}${movingInitial}${input}`;
    }

    const initialIndex = initials.indexOf(lastCharacter as (typeof initials)[number]);
    if (initialIndex >= 0) return `${prefix}${composeSyllable(initialIndex, inputVowelIndex)}`;
    const combined = vowelCombinations[`${lastCharacter}${input}`];
    return combined ? `${prefix}${combined}` : `${value}${input}`;
  }

  if (syllable && inputFinalIndex > 0) {
    if (syllable.finalIndex === 0) {
      return `${prefix}${composeSyllable(syllable.initialIndex, syllable.vowelIndex, inputFinalIndex)}`;
    }
    const combined = finalCombinations[`${finals[syllable.finalIndex]}${input}`];
    const combinedIndex = combined ? finals.indexOf(combined as (typeof finals)[number]) : -1;
    if (combinedIndex > 0) return `${prefix}${composeSyllable(syllable.initialIndex, syllable.vowelIndex, combinedIndex)}`;
  }

  return `${value}${input}`;
}

export function removeLastHangulInput(value: string) {
  if (!value) return value;
  const prefix = value.slice(0, -1);
  const lastCharacter = value.slice(-1);
  const syllable = getSyllableParts(lastCharacter);
  if (!syllable) return prefix;

  if (syllable.finalIndex > 0) {
    const split = finalSplits[finals[syllable.finalIndex]];
    const nextFinalIndex = split ? finals.indexOf(split[0] as (typeof finals)[number]) : 0;
    return `${prefix}${composeSyllable(syllable.initialIndex, syllable.vowelIndex, nextFinalIndex)}`;
  }

  const split = vowelSplits[vowels[syllable.vowelIndex]];
  if (split) return `${prefix}${composeSyllable(syllable.initialIndex, vowels.indexOf(split[0] as (typeof vowels)[number]))}`;
  return `${prefix}${initials[syllable.initialIndex]}`;
}

export function KoreanKeyboard({ id, onInput, onClose }: { id: string; onInput: (action: KoreanKeyboardAction) => void; onClose: () => void }) {
  const keepInputFocused = (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault();

  return (
    <Panel id={id} role="group" aria-label="Корейская экранная клавиатура">
      <Header>
        <div><Title>Корейская клавиатура</Title><Subtitle>Буквы автоматически собираются в слоги</Subtitle></div>
        <Close type="button" onClick={onClose} aria-label="Закрыть клавиатуру">×</Close>
      </Header>
      <DoubleRow role="group" aria-label="Двойные буквы">
        {doubleKeys.map((key) => <Key key={key} type="button" $secondary onMouseDown={keepInputFocused} onClick={() => onInput(key)}>{key}</Key>)}
      </DoubleRow>
      <Rows>
        {keyboardRows.map((row, index) => <Row key={index}>{row.map((key) => <Key key={key} type="button" onMouseDown={keepInputFocused} onClick={() => onInput(key)}>{key}</Key>)}</Row>)}
      </Rows>
      <Actions>
        <Action type="button" onMouseDown={keepInputFocused} onClick={() => onInput("space")}>Пробел</Action>
        <Action type="button" onMouseDown={keepInputFocused} onClick={() => onInput("backspace")}>← Удалить</Action>
      </Actions>
    </Panel>
  );
}

const keyboardReveal = keyframes`
  from { opacity: 0; transform: translateY(-5px) scale(.99); }
  to { opacity: 1; transform: none; }
`;

const Panel = styled.div`
  width: min(100%, 45rem);
  margin: 0.85rem auto 0;
  display: grid;
  gap: 0.72rem;
  overflow: hidden;
  border: 1px solid rgba(176,190,255,.76);
  border-radius: 1.3rem;
  background: radial-gradient(circle at 100% 0%, rgba(139,92,246,.08), transparent 35%), linear-gradient(155deg, rgba(248,250,255,.98), rgba(239,243,255,.96));
  padding: 0.9rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.96), 0 18px 38px rgba(53,67,145,.11);
  animation: ${keyboardReveal} 180ms ease both;
  @media (max-width: 767px) { display: none; }
`;
const Header = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:.12rem .15rem .2rem;`;
const Title = styled.p`color:#1b2850;font-size:.9rem;font-weight:950;`;
const Subtitle = styled.p`margin-top:.18rem;color:#7180a6;font-size:.74rem;font-weight:700;line-height:1.4;`;
const Close = styled.button`
  display:grid;place-items:center;flex:0 0 auto;width:1.9rem;height:1.9rem;border:0;border-radius:.7rem;background:rgba(255,255,255,.76);color:#66749a;font-size:1.2rem;cursor:pointer;
  &:hover{background:#fff;color:#283a93;}
`;
const Rows = styled.div`display:grid;gap:.42rem;`;
const Row = styled.div`display:flex;justify-content:center;gap:.42rem;`;
const DoubleRow = styled.div`display:flex;justify-content:center;gap:.38rem;padding-bottom:.05rem;`;
const Key = styled.button<{ $secondary?: boolean }>`
  display:grid;place-items:center;flex:0 1 3.25rem;min-width:2.3rem;height:${({ $secondary }) => $secondary ? "2.15rem" : "2.75rem"};border:1px solid ${({ $secondary }) => $secondary ? "rgba(192,201,239,.82)" : "rgba(170,184,247,.88)"};border-radius:${({ $secondary }) => $secondary ? ".72rem" : ".86rem"};background:${({ $secondary }) => $secondary ? "rgba(248,249,255,.82)" : "rgba(255,255,255,.96)"};color:${({ $secondary }) => $secondary ? "#60709b" : "#18264f"};box-shadow:0 3px 0 rgba(139,153,216,.2),0 7px 14px rgba(64,78,151,.07);font-size:${({ $secondary }) => $secondary ? ".9rem" : "1.08rem"};font-weight:950;cursor:pointer;transition:transform 100ms ease,border-color 130ms ease,background 130ms ease,color 130ms ease,box-shadow 130ms ease;
  &:hover{border-color:rgba(90,108,255,.72);background:#f8f9ff;color:#3347c8;box-shadow:0 3px 0 rgba(90,108,255,.25),0 9px 18px rgba(64,78,151,.12);}
  &:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(90,108,255,.24);}
`;
const Actions = styled.div`display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:.5rem;width:min(100%,24rem);margin-inline:auto;`;
const Action = styled.button`
  height:2.45rem;border:1px solid rgba(170,184,247,.78);border-radius:.82rem;background:rgba(255,255,255,.88);color:#46557f;font-size:.78rem;font-weight:900;cursor:pointer;transition:background 130ms ease,border-color 130ms ease,color 130ms ease,transform 100ms ease;
  &:hover{border-color:rgba(90,108,255,.68);background:#f8f9ff;color:#3347c8;}
  &:active{transform:translateY(1px);}
`;
