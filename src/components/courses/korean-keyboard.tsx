"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import styled, { keyframes } from "styled-components";

const keyboardReveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.35rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export type KoreanKeyboardAction = "backspace" | "space" | string;

const KOREAN_KEYBOARD_ROWS = [
  ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
  ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
  ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"],
] as const;

const KOREAN_KEYBOARD_DOUBLE_KEYS = ["ㅃ", "ㅉ", "ㄸ", "ㄲ", "ㅆ", "ㅒ", "ㅖ"] as const;

const HANGUL_INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;
const HANGUL_VOWELS = [
  "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ",
  "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ",
] as const;
const HANGUL_FINALS = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
  "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

const HANGUL_VOWEL_COMBINATIONS: Record<string, string> = {
  "ㅗㅏ": "ㅘ",
  "ㅗㅐ": "ㅙ",
  "ㅗㅣ": "ㅚ",
  "ㅘㅣ": "ㅙ",
  "ㅜㅓ": "ㅝ",
  "ㅜㅔ": "ㅞ",
  "ㅜㅣ": "ㅟ",
  "ㅝㅣ": "ㅞ",
  "ㅡㅣ": "ㅢ",
};

const HANGUL_VOWEL_SPLITS: Record<string, [string, string]> = {
  "ㅘ": ["ㅗ", "ㅏ"],
  "ㅙ": ["ㅘ", "ㅣ"],
  "ㅚ": ["ㅗ", "ㅣ"],
  "ㅝ": ["ㅜ", "ㅓ"],
  "ㅞ": ["ㅝ", "ㅣ"],
  "ㅟ": ["ㅜ", "ㅣ"],
  "ㅢ": ["ㅡ", "ㅣ"],
};

const HANGUL_FINAL_COMBINATIONS: Record<string, string> = {
  "ㄱㅅ": "ㄳ",
  "ㄴㅈ": "ㄵ",
  "ㄴㅎ": "ㄶ",
  "ㄹㄱ": "ㄺ",
  "ㄹㅁ": "ㄻ",
  "ㄹㅂ": "ㄼ",
  "ㄹㅅ": "ㄽ",
  "ㄹㅌ": "ㄾ",
  "ㄹㅍ": "ㄿ",
  "ㄹㅎ": "ㅀ",
  "ㅂㅅ": "ㅄ",
};

const HANGUL_FINAL_SPLITS: Record<string, [string, string]> = {
  "ㄳ": ["ㄱ", "ㅅ"],
  "ㄵ": ["ㄴ", "ㅈ"],
  "ㄶ": ["ㄴ", "ㅎ"],
  "ㄺ": ["ㄹ", "ㄱ"],
  "ㄻ": ["ㄹ", "ㅁ"],
  "ㄼ": ["ㄹ", "ㅂ"],
  "ㄽ": ["ㄹ", "ㅅ"],
  "ㄾ": ["ㄹ", "ㅌ"],
  "ㄿ": ["ㄹ", "ㅍ"],
  "ㅀ": ["ㄹ", "ㅎ"],
  "ㅄ": ["ㅂ", "ㅅ"],
};

function getHangulSyllableParts(character: string) {
  const syllableIndex = character.charCodeAt(0) - 0xac00;
  if (syllableIndex < 0 || syllableIndex > 0xd7a3 - 0xac00) {
    return null;
  }

  return {
    initialIndex: Math.floor(syllableIndex / 588),
    vowelIndex: Math.floor((syllableIndex % 588) / 28),
    finalIndex: syllableIndex % 28,
  };
}

function composeHangulSyllable(initialIndex: number, vowelIndex: number, finalIndex = 0) {
  return String.fromCharCode(0xac00 + initialIndex * 588 + vowelIndex * 28 + finalIndex);
}

export function appendHangulInput(value: string, input: string) {
  if (!value) {
    return input;
  }

  const prefix = value.slice(0, -1);
  const lastCharacter = value.slice(-1);
  const syllable = getHangulSyllableParts(lastCharacter);
  const inputVowelIndex = HANGUL_VOWELS.indexOf(
    input as (typeof HANGUL_VOWELS)[number],
  );
  const inputFinalIndex = HANGUL_FINALS.indexOf(
    input as (typeof HANGUL_FINALS)[number],
  );

  if (inputVowelIndex >= 0) {
    if (syllable) {
      if (syllable.finalIndex === 0) {
        const currentVowel = HANGUL_VOWELS[syllable.vowelIndex];
        const combinedVowel = HANGUL_VOWEL_COMBINATIONS[`${currentVowel}${input}`];
        const combinedVowelIndex = combinedVowel
          ? HANGUL_VOWELS.indexOf(combinedVowel as (typeof HANGUL_VOWELS)[number])
          : -1;

        return combinedVowelIndex >= 0
          ? `${prefix}${composeHangulSyllable(
              syllable.initialIndex,
              combinedVowelIndex,
            )}`
          : `${value}${input}`;
      }

      const currentFinal = HANGUL_FINALS[syllable.finalIndex];
      const splitFinal = HANGUL_FINAL_SPLITS[currentFinal];
      const remainingFinal = splitFinal?.[0] ?? "";
      const movingInitial = splitFinal?.[1] ?? currentFinal;
      const movingInitialIndex = HANGUL_INITIALS.indexOf(
        movingInitial as (typeof HANGUL_INITIALS)[number],
      );
      const remainingFinalIndex = HANGUL_FINALS.indexOf(
        remainingFinal as (typeof HANGUL_FINALS)[number],
      );
      const previousSyllable = composeHangulSyllable(
        syllable.initialIndex,
        syllable.vowelIndex,
        Math.max(0, remainingFinalIndex),
      );

      return movingInitialIndex >= 0
        ? `${prefix}${previousSyllable}${composeHangulSyllable(
            movingInitialIndex,
            inputVowelIndex,
          )}`
        : `${prefix}${previousSyllable}${movingInitial}${input}`;
    }

    const standaloneInitialIndex = HANGUL_INITIALS.indexOf(
      lastCharacter as (typeof HANGUL_INITIALS)[number],
    );
    if (standaloneInitialIndex >= 0) {
      return `${prefix}${composeHangulSyllable(standaloneInitialIndex, inputVowelIndex)}`;
    }

    const combinedVowel = HANGUL_VOWEL_COMBINATIONS[`${lastCharacter}${input}`];
    return combinedVowel ? `${prefix}${combinedVowel}` : `${value}${input}`;
  }

  if (syllable && inputFinalIndex > 0) {
    if (syllable.finalIndex === 0) {
      return `${prefix}${composeHangulSyllable(
        syllable.initialIndex,
        syllable.vowelIndex,
        inputFinalIndex,
      )}`;
    }

    const currentFinal = HANGUL_FINALS[syllable.finalIndex];
    const combinedFinal = HANGUL_FINAL_COMBINATIONS[`${currentFinal}${input}`];
    const combinedFinalIndex = combinedFinal
      ? HANGUL_FINALS.indexOf(combinedFinal as (typeof HANGUL_FINALS)[number])
      : -1;

    if (combinedFinalIndex > 0) {
      return `${prefix}${composeHangulSyllable(
        syllable.initialIndex,
        syllable.vowelIndex,
        combinedFinalIndex,
      )}`;
    }
  }

  return `${value}${input}`;
}

export function removeLastHangulInput(value: string) {
  if (!value) {
    return value;
  }

  const prefix = value.slice(0, -1);
  const lastCharacter = value.slice(-1);
  const syllable = getHangulSyllableParts(lastCharacter);
  if (!syllable) {
    return prefix;
  }

  if (syllable.finalIndex > 0) {
    const currentFinal = HANGUL_FINALS[syllable.finalIndex];
    const splitFinal = HANGUL_FINAL_SPLITS[currentFinal];
    const nextFinalIndex = splitFinal
      ? HANGUL_FINALS.indexOf(splitFinal[0] as (typeof HANGUL_FINALS)[number])
      : 0;

    return `${prefix}${composeHangulSyllable(
      syllable.initialIndex,
      syllable.vowelIndex,
      nextFinalIndex,
    )}`;
  }

  const currentVowel = HANGUL_VOWELS[syllable.vowelIndex];
  const splitVowel = HANGUL_VOWEL_SPLITS[currentVowel];
  if (splitVowel) {
    const nextVowelIndex = HANGUL_VOWELS.indexOf(
      splitVowel[0] as (typeof HANGUL_VOWELS)[number],
    );
    return `${prefix}${composeHangulSyllable(syllable.initialIndex, nextVowelIndex)}`;
  }

  return `${prefix}${HANGUL_INITIALS[syllable.initialIndex]}`;
}

export function KoreanKeyboard({
  id,
  onInput,
  onClose,
}: {
  id: string;
  onInput: (action: KoreanKeyboardAction) => void;
  onClose: () => void;
}) {
  const keepInputFocused = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <KoreanKeyboardPanel
      id={id}
      role="group"
      aria-label="Корейская экранная клавиатура"
    >
      <KoreanKeyboardHeader>
        <div>
          <KoreanKeyboardTitle>Корейская клавиатура</KoreanKeyboardTitle>
          <KoreanKeyboardSubtitle>
            Нажимайте буквы — они соберутся в слоги автоматически
          </KoreanKeyboardSubtitle>
        </div>
        <KoreanKeyboardCloseButton
          type="button"
          onClick={onClose}
          aria-label="Закрыть клавиатуру"
        >
          ×
        </KoreanKeyboardCloseButton>
      </KoreanKeyboardHeader>

      <KoreanKeyboardDoubleRow role="group" aria-label="Двойные буквы">
        {KOREAN_KEYBOARD_DOUBLE_KEYS.map((key) => (
          <KoreanKeyboardKeyButton
            key={key}
            type="button"
            $secondary
            onMouseDown={keepInputFocused}
            onClick={() => onInput(key)}
          >
            {key}
          </KoreanKeyboardKeyButton>
        ))}
      </KoreanKeyboardDoubleRow>

      <KoreanKeyboardRows>
        {KOREAN_KEYBOARD_ROWS.map((row, rowIndex) => (
          <KoreanKeyboardRow key={rowIndex}>
            {row.map((key) => (
              <KoreanKeyboardKeyButton
                key={key}
                type="button"
                onMouseDown={keepInputFocused}
                onClick={() => onInput(key)}
              >
                {key}
              </KoreanKeyboardKeyButton>
            ))}
          </KoreanKeyboardRow>
        ))}
      </KoreanKeyboardRows>

      <KoreanKeyboardActions>
        <KoreanKeyboardActionButton
          type="button"
          onMouseDown={keepInputFocused}
          onClick={() => onInput("space")}
        >
          Пробел
        </KoreanKeyboardActionButton>
        <KoreanKeyboardActionButton
          type="button"
          onMouseDown={keepInputFocused}
          onClick={() => onInput("backspace")}
        >
          ← Удалить
        </KoreanKeyboardActionButton>
      </KoreanKeyboardActions>
    </KoreanKeyboardPanel>
  );
}

const KoreanKeyboardPanel = styled.div`
  display: grid;
  gap: 0.8rem;
  overflow: hidden;
  border: 1px solid rgba(176, 190, 255, 0.82);
  border-radius: 1.3rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.08), transparent 35%),
    linear-gradient(155deg, rgba(248, 250, 255, 0.98), rgba(239, 243, 255, 0.96));
  padding: 0.9rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 18px 38px rgba(53, 67, 145, 0.12);
  animation: ${keyboardReveal} 180ms ease both;

  @media (max-width: 767px) {
    display: none;
  }
`;

const KoreanKeyboardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.12rem 0.15rem 0.2rem;
`;

const KoreanKeyboardTitle = styled.p`
  color: #1b2850;
  font-size: 0.9rem;
  font-weight: 950;
`;

const KoreanKeyboardSubtitle = styled.p`
  margin-top: 0.18rem;
  color: #7180a6;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.4;
`;

const KoreanKeyboardCloseButton = styled.button`
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 1.9rem;
  height: 1.9rem;
  border: 0;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.76);
  color: #66749a;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #ffffff;
    color: #283a93;
  }
`;

const KoreanKeyboardRows = styled.div`
  display: grid;
  gap: 0.42rem;
`;

const KoreanKeyboardRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.42rem;
`;

const KoreanKeyboardDoubleRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.38rem;
  padding-bottom: 0.05rem;
`;

const KoreanKeyboardKeyButton = styled.button<{ $secondary?: boolean }>`
  display: inline-grid;
  place-items: center;
  flex: 0 1 3.25rem;
  min-width: 2.3rem;
  height: ${({ $secondary = false }) => ($secondary ? "2.15rem" : "2.75rem")};
  border: 1px solid
    ${({ $secondary = false }) =>
      $secondary ? "rgba(192, 201, 239, 0.82)" : "rgba(170, 184, 247, 0.88)"};
  border-radius: ${({ $secondary = false }) => ($secondary ? "0.72rem" : "0.86rem")};
  background: ${({ $secondary = false }) =>
    $secondary ? "rgba(248, 249, 255, 0.82)" : "rgba(255, 255, 255, 0.96)"};
  color: ${({ $secondary = false }) => ($secondary ? "#60709b" : "#18264f")};
  box-shadow:
    0 3px 0 rgba(139, 153, 216, 0.2),
    0 7px 14px rgba(64, 78, 151, 0.07);
  font-size: ${({ $secondary = false }) => ($secondary ? "0.9rem" : "1.08rem")};
  font-weight: 950;
  line-height: 1;
  cursor: pointer;
  transition:
    transform 100ms ease,
    border-color 130ms ease,
    background 130ms ease,
    color 130ms ease,
    box-shadow 130ms ease;

  &:hover {
    border-color: rgba(90, 108, 255, 0.72);
    background: #f8f9ff;
    color: #3347c8;
    box-shadow:
      0 3px 0 rgba(90, 108, 255, 0.25),
      0 9px 18px rgba(64, 78, 151, 0.12);
  }

  &:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 rgba(90, 108, 255, 0.24);
  }
`;

const KoreanKeyboardActions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 0.5rem;
  width: min(100%, 24rem);
  margin-inline: auto;
`;

const KoreanKeyboardActionButton = styled.button`
  height: 2.45rem;
  border: 1px solid rgba(170, 184, 247, 0.78);
  border-radius: 0.82rem;
  background: rgba(255, 255, 255, 0.88);
  color: #46557f;
  font-size: 0.78rem;
  font-weight: 900;
  cursor: pointer;
  transition:
    background 130ms ease,
    border-color 130ms ease,
    color 130ms ease,
    transform 100ms ease;

  &:hover {
    border-color: rgba(90, 108, 255, 0.68);
    background: #f8f9ff;
    color: #3347c8;
  }

  &:active {
    transform: translateY(1px);
  }
`;

