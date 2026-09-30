import Link from "next/link";
import styled, { css } from "styled-components";

export const actionBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  border-radius: 9999px;
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform 160ms ease,
    opacity 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease;

  &:hover {
    transform: translateY(-2px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
  }
`;

export const SecondaryButton = styled.button`
  ${actionBase};
  border-color: var(--line);
  background: rgba(255, 255, 255, 0.82);
  color: #24314f;
  padding: 0.7rem 1rem;
  font-size: 0.9rem;
  font-weight: 700;

  &:hover {
    border-color: var(--line-strong);
    background: white;
  }
`;

export const SecondaryLink = styled(Link)`
  ${actionBase};
  border-color: var(--line);
  background: rgba(255, 255, 255, 0.82);
  color: #24314f;
  padding: 0.7rem 1rem;
  font-size: 0.9rem;
  font-weight: 700;

  &:hover {
    border-color: var(--line-strong);
    background: white;
  }
`;

export const PrimaryButton = styled.button`
  ${actionBase};
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: white;
  padding: 0.78rem 1.2rem;
  box-shadow: 0 12px 28px rgba(63, 84, 186, 0.2);
  font-size: 0.9rem;
  font-weight: 800;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.28), transparent);
    transform: translateX(-130%);
    transition: transform 420ms ease;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 34px rgba(63, 84, 186, 0.28);
  }

  &:not(:disabled):hover::after {
    transform: translateX(130%);
  }

  &:not(:disabled):active {
    transform: translateY(2px) scale(0.98);
    box-shadow: 0 7px 14px rgba(63, 84, 186, 0.16);
  }
`;

export const PrimaryLink = styled(Link)`
  ${actionBase};
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: white;
  padding: 0.78rem 1.2rem;
  box-shadow: 0 12px 28px rgba(63, 84, 186, 0.2);
  font-size: 0.9rem;
  font-weight: 800;
`;

