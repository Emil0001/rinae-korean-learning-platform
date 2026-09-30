import styled from "styled-components";

export const PracticeListeningCard = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  width: min(100%, 46rem);
  border: 1px solid rgba(181, 196, 255, 0.92);
  border-radius: 1.55rem;
  background:
    radial-gradient(circle at 12% 18%, rgba(139, 92, 246, 0.16), transparent 32%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(242, 246, 255, 0.92));
  padding: clamp(0.9rem, 2.2vw, 1.2rem);
  box-shadow: 0 18px 42px rgba(46, 59, 146, 0.11);

  @media (max-width: 767px) {
    border: 0;
    border-radius: 0;
    background: transparent;
    padding-inline: 0;
    box-shadow: none;
  }
`;

export const QuizListeningCard = styled(PracticeListeningCard)`
  margin-top: 1rem;
  margin-bottom: 0.5rem;
`;

export const PracticeListeningIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(3rem, 7vw, 4.1rem);
  height: clamp(3rem, 7vw, 4.1rem);
  border-radius: 1.25rem;
  background: linear-gradient(135deg, rgba(90, 108, 255, 0.16), rgba(139, 92, 246, 0.16));
  box-shadow: inset 0 0 0 1px rgba(181, 196, 255, 0.58);
  font-size: clamp(1.5rem, 4vw, 2rem);
`;

export const PracticeListeningCopy = styled.div`
  display: grid;
  gap: 0.25rem;
`;

export const PracticeListeningLabel = styled.span`
  color: #17203d;
  font-size: clamp(1.05rem, 2vw, 1.25rem);
  font-weight: 950;
`;

export const PracticeListeningHint = styled.span`
  color: #60709c;
  font-size: 0.95rem;
  font-weight: 700;
`;

export const PracticeListeningPlayer = styled.audio`
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
  border-radius: 999px;
`;

