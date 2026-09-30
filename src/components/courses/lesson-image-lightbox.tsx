"use client";

import { useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";

export function LessonImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(true);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!zoomed) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [zoomed]);

  return (
    <ImageLightboxBackdrop
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Просмотр изображения"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <ImageLightboxPanel>
        <ImageLightboxToolbar>
          <ImageLightboxHint>
            {zoomed ? "Перемещайте изображение, чтобы рассмотреть детали" : "Изображение целиком"}
          </ImageLightboxHint>
          <ImageLightboxActions>
            <ImageLightboxAction type="button" onClick={() => setZoomed((value) => !value)}>
              {zoomed ? "По размеру экрана" : "Увеличить"}
            </ImageLightboxAction>
            <ImageLightboxClose
              type="button"
              onClick={onClose}
              aria-label="Закрыть изображение"
              autoFocus
            >
              ×
            </ImageLightboxClose>
          </ImageLightboxActions>
        </ImageLightboxToolbar>
        <ImageLightboxViewport ref={viewportRef}>
          <ImageLightboxCanvas $zoomed={zoomed}>
            <ImageLightboxImageButton
              type="button"
              onClick={() => setZoomed((value) => !value)}
              $zoomed={zoomed}
              aria-label={zoomed ? "Показать изображение целиком" : "Увеличить изображение"}
            >
              <ImageLightboxImage src={src} alt={alt} $zoomed={zoomed} />
            </ImageLightboxImageButton>
          </ImageLightboxCanvas>
        </ImageLightboxViewport>
      </ImageLightboxPanel>
    </ImageLightboxBackdrop>
  );
}

const ImageLightboxBackdrop = styled.div`
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(7, 12, 26, 0.86);
  padding: 0.6rem;
  backdrop-filter: blur(8px);

  @media (max-width: 767px) {
    padding: 0;
  }
`;

const ImageLightboxPanel = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(96vw, 72rem);
  height: min(94vh, 60rem);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1.25rem;
  background: #111827;
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.45);

  @media (max-width: 767px) {
    width: 100vw;
    height: 100dvh;
    border-radius: 0;
  }
`;

const ImageLightboxToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.8rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 23, 42, 0.96);
`;

const ImageLightboxHint = styled.p`
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.75rem;
  line-height: 1.35;

  @media (max-width: 560px) {
    display: none;
  }
`;

const ImageLightboxActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
`;

const ImageLightboxAction = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 800;
`;

const ImageLightboxClose = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 1.5rem;
  line-height: 1;
`;

const ImageLightboxViewport = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y pinch-zoom;
`;

const ImageLightboxCanvas = styled.div<{ $zoomed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $zoomed }) => ($zoomed ? "min(64rem, 220vw)" : "100%")};
  min-width: 100%;
  min-height: 100%;
  margin: 0 auto;
  padding: ${({ $zoomed }) => ($zoomed ? "1rem" : "0.5rem")};
`;

const ImageLightboxImageButton = styled.button<{ $zoomed: boolean }>`
  display: flex;
  width: 100%;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: ${({ $zoomed }) => ($zoomed ? "zoom-out" : "zoom-in")};
`;

const ImageLightboxImage = styled.img<{ $zoomed: boolean }>`
  display: block;
  width: 100%;
  height: auto;
  max-height: ${({ $zoomed }) => ($zoomed ? "none" : "calc(94vh - 5rem)")};
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
`;

