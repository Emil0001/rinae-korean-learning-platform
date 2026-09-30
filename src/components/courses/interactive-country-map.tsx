"use client";

import { useState } from "react";
import styled, { keyframes } from "styled-components";

type Country = {
  code: string;
  korean: string;
  russian: string;
  nationality: string;
  nationalityRussian: string;
  character: string;
  desktop: { x: number; y: number };
  mobile: { x: number; y: number };
};

const countries: Country[] = [
  { code: "KR", korean: "한국", russian: "Корея", nationality: "한국 사람", nationalityRussian: "кореец", character: "/map_characters/01_KR_한국_Корея_3D_Clay.png", desktop: { x: 82, y: 42 }, mobile: { x: 82, y: 47 } },
  { code: "RU", korean: "러시아", russian: "Россия", nationality: "러시아 사람", nationalityRussian: "россиянин", character: "/map_characters/02_RU_러시아_Россия_3D_Clay.png", desktop: { x: 68, y: 18 }, mobile: { x: 70, y: 34 } },
  { code: "US", korean: "미국", russian: "США", nationality: "미국 사람", nationalityRussian: "американец", character: "/map_characters/03_US_미국_США_3D_Clay.png", desktop: { x: 19, y: 37 }, mobile: { x: 18, y: 42 } },
  { code: "GB", korean: "영국", russian: "Великобритания", nationality: "영국 사람", nationalityRussian: "британец", character: "/map_characters/04_GB_영국_Великобритания_3D_Clay.png", desktop: { x: 43, y: 20 }, mobile: { x: 46, y: 39 } },
  { code: "FR", korean: "프랑스", russian: "Франция", nationality: "프랑스 사람", nationalityRussian: "француз", character: "/map_characters/05_FR_프랑스_Франция_3D_Clay.png", desktop: { x: 43, y: 40 }, mobile: { x: 46, y: 46 } },
  { code: "DE", korean: "독일", russian: "Германия", nationality: "독일 사람", nationalityRussian: "немец", character: "/map_characters/06_DE_독일_Германия_3D_Clay.png", desktop: { x: 49, y: 34 }, mobile: { x: 52, y: 42 } },
  { code: "GR", korean: "그리스", russian: "Греция", nationality: "그리스 사람", nationalityRussian: "грек", character: "/map_characters/07_GR_그리스_Греция_3D_Clay.png", desktop: { x: 50, y: 48 }, mobile: { x: 54, y: 50 } },
  { code: "KZ", korean: "카자흐스탄", russian: "Казахстан", nationality: "카자흐스탄 사람", nationalityRussian: "казахстанец", character: "/map_characters/08_KZ_카자흐스탄_Казахстан_3D_Clay.png", desktop: { x: 65, y: 38 }, mobile: { x: 66, y: 45 } },
  { code: "UZ", korean: "우즈베키스탄", russian: "Узбекистан", nationality: "우즈베키스탄 사람", nationalityRussian: "узбекистанец", character: "/map_characters/09_UZ_우즈베키스탄_Узбекистан_3D_Clay.png", desktop: { x: 61, y: 48 }, mobile: { x: 64, y: 50 } },
  { code: "MN", korean: "몽골", russian: "Монголия", nationality: "몽골 사람", nationalityRussian: "монгол", character: "/map_characters/10_MN_몽골_Монголия_3D_Clay.png", desktop: { x: 73, y: 36 }, mobile: { x: 74, y: 43 } },
  { code: "CN", korean: "중국", russian: "Китай", nationality: "중국 사람", nationalityRussian: "китаец", character: "/map_characters/11_CN_중국_Китай_3D_Clay.png", desktop: { x: 72, y: 50 }, mobile: { x: 72, y: 52 } },
  { code: "JP", korean: "일본", russian: "Япония", nationality: "일본 사람", nationalityRussian: "японец", character: "/map_characters/12_JP_일본_Япония_3D_Clay.png", desktop: { x: 88, y: 47 }, mobile: { x: 88, y: 49 } },
  { code: "TH", korean: "태국", russian: "Таиланд", nationality: "태국 사람", nationalityRussian: "таец", character: "/map_characters/13_TH_태국_Таиланд_3D_Clay.png", desktop: { x: 70, y: 65 }, mobile: { x: 71, y: 59 } },
  { code: "VN", korean: "베트남", russian: "Вьетнам", nationality: "베트남 사람", nationalityRussian: "вьетнамец", character: "/map_characters/14_VN_베트남_Вьетнам_3D_Clay.png", desktop: { x: 77, y: 62 }, mobile: { x: 78, y: 58 } },
  { code: "MY", korean: "말레이시아", russian: "Малайзия", nationality: "말레이시아 사람", nationalityRussian: "малайзиец", character: "/map_characters/15_MY_말레이시아_Малайзия_3D_Clay.png", desktop: { x: 74, y: 76 }, mobile: { x: 75, y: 66 } },
  { code: "AU", korean: "호주", russian: "Австралия", nationality: "호주 사람", nationalityRussian: "австралиец", character: "/map_characters/16_AU_호주_Австралия_3D_Clay.png", desktop: { x: 82, y: 78 }, mobile: { x: 82, y: 67 } },
];

export function InteractiveCountryMap() {
  const [selectedCode, setSelectedCode] = useState("KR");
  const selected = countries.find((country) => country.code === selectedCode) ?? countries[0];

  return (
    <MapModule>
      <MapHeader>
        <MapHeaderCopy>
          <MapKicker>나라 · страны</MapKicker>
          <MapTitle>Карта стран и национальностей</MapTitle>
          <MapDescription>
            Выберите персонажа на карте, чтобы увидеть название страны и готовую фразу.
          </MapDescription>
        </MapHeaderCopy>
        <Formula>
          <FormulaBadge>Формула</FormulaBadge>
          <strong>나라</strong><span>+</span><strong>사람</strong><span>= житель страны</span>
        </Formula>
      </MapHeader>

      <MapCanvas>
        <picture>
          <source media="(max-width: 700px)" srcSet="/map_characters/map_mobile.png" />
          <MapImage src="/map_characters/map_desktop.png" alt="Интерактивная карта стран мира" />
        </picture>
        {countries.map((country) => {
          const isSelected = country.code === selected.code;
          return (
            <CountryMarker
              key={country.code}
              type="button"
              aria-label={`${country.korean}, ${country.russian}`}
              aria-pressed={isSelected}
              $selected={isSelected}
              $desktopX={country.desktop.x}
              $desktopY={country.desktop.y}
              $mobileX={country.mobile.x}
              $mobileY={country.mobile.y}
              onClick={() => setSelectedCode(country.code)}
            >
              <MarkerCharacter src={country.character} alt="" aria-hidden="true" />
              <MarkerCode>{country.code}</MarkerCode>
              <MarkerLabel $selected={isSelected}>
                <strong>{country.korean}</strong>
                <span>{country.russian}</span>
              </MarkerLabel>
              <MarkerTooltip><strong>{country.korean}</strong><span>{country.russian}</span></MarkerTooltip>
            </CountryMarker>
          );
        })}
      </MapCanvas>

      <CountryPanel key={selected.code} aria-live="polite">
        <CountryPortrait>
          <CountryPortraitImage src={selected.character} alt={`Персонаж: ${selected.russian}`} />
          <span>{selected.code}</span>
        </CountryPortrait>
        <CountryIdentity>
          <CountryNames><strong>{selected.korean}</strong><span>{selected.russian}</span></CountryNames>
          <NationalityPill><strong>{selected.nationality}</strong><span>{selected.nationalityRussian}</span></NationalityPill>
        </CountryIdentity>
        <PhraseCard>
          <p><span>Q</span> 어느 나라 사람이에요?</p>
          <p><span>A</span> 저는 <strong>{selected.nationality}</strong>이에요.</p>
          <small>Страна: {selected.russian} · национальность: {selected.nationalityRussian}.</small>
        </PhraseCard>
      </CountryPanel>

      <CountryDirectory>
        <DirectoryTitle><span>Все страны</span><small>{countries.length} персонажей</small></DirectoryTitle>
        <CountryTabs role="list" aria-label="Список стран">
          {countries.map((country) => (
            <CountryTab
              key={country.code}
              type="button"
              role="listitem"
              $selected={country.code === selected.code}
              onClick={() => setSelectedCode(country.code)}
            >
              <CountryTabImage src={country.character} alt="" aria-hidden="true" />
              <span><strong>{country.korean}</strong><small>{country.russian}</small></span>
            </CountryTab>
          ))}
        </CountryTabs>
      </CountryDirectory>
    </MapModule>
  );
}

const panelIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const MapModule = styled.section`
  width: 100%; overflow: hidden;
  border: 1px solid rgba(166, 186, 255, 0.78); border-radius: 2rem;
  background: rgba(248, 251, 255, 0.98);
  box-shadow: 0 26px 64px rgba(48, 74, 157, 0.13);
`;

const MapHeader = styled.header`
  display: flex; align-items: center; justify-content: space-between; gap: 1.25rem;
  padding: 1.35rem 1.5rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 245, 255, 0.98));
  @media (max-width: 800px) { align-items: flex-start; flex-direction: column; padding: 1.1rem; }
`;

const MapHeaderCopy = styled.div`min-width: 0;`;

const MapKicker = styled.p`
  margin: 0 0 0.35rem; color: #5264ed; font-size: 0.72rem; font-weight: 900;
  letter-spacing: 0.17em; text-transform: uppercase;
`;

const MapTitle = styled.h3`
  margin: 0; color: #17213f; font-size: clamp(1.35rem, 2.4vw, 2rem);
  font-weight: 900; line-height: 1.15;
`;

const MapDescription = styled.p`
  margin: 0.45rem 0 0; color: #68779c; font-size: 0.94rem; font-weight: 650; line-height: 1.55;
`;

const Formula = styled.div`
  display: flex; flex: 0 0 auto; align-items: center; gap: 0.45rem;
  border: 1px solid rgba(145, 166, 255, 0.72); border-radius: 1rem;
  background: rgba(255, 255, 255, 0.86); padding: 0.65rem 0.8rem;
  color: #243252; font-size: 0.86rem; box-shadow: 0 10px 25px rgba(62, 83, 171, 0.08);
  strong { color: #4058e8; font-size: 1rem; }
  @media (max-width: 540px) { width: 100%; flex-wrap: wrap; }
`;

const FormulaBadge = styled.span`
  border-radius: 999px; background: #5264ed; padding: 0.28rem 0.5rem;
  color: white; font-size: 0.65rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase;
`;

const MapCanvas = styled.div`
  position: relative; width: 100%; aspect-ratio: 2 / 1; overflow: hidden;
  border-block: 1px solid rgba(166, 186, 255, 0.58); background: #a9e6f5;
  picture { position: absolute; inset: 0; }
  @media (max-width: 700px) { aspect-ratio: 0.82 / 1; }
`;

const MapImage = styled.img`
  display: block; width: 100%; height: 100%; object-fit: cover;
`;

const CountryMarker = styled.button<{
  $selected: boolean; $desktopX: number; $desktopY: number; $mobileX: number; $mobileY: number;
}>`
  position: absolute; z-index: ${({ $selected }) => ($selected ? 4 : 2)};
  left: ${({ $desktopX }) => $desktopX}%; top: ${({ $desktopY }) => $desktopY}%;
  display: grid; place-items: center; width: 3.7rem; height: 3.7rem;
  border: 3px solid ${({ $selected }) => ($selected ? "#5264ed" : "rgba(255,255,255,.94)")};
  border-radius: 50%; background: rgba(255, 255, 255, 0.92); padding: 0.2rem;
  box-shadow: ${({ $selected }) => $selected ? "0 0 0 6px rgba(82,100,237,.2), 0 14px 28px rgba(35,54,139,.26)" : "0 8px 20px rgba(38,68,120,.2)"};
  transform: translate(-50%, -50%); cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  &:hover, &:focus-visible {
    z-index: 5; border-color: #5264ed; outline: none;
    transform: translate(-50%, calc(-50% - 5px)) scale(1.13);
    box-shadow: 0 0 0 6px rgba(82,100,237,.2), 0 16px 30px rgba(35,54,139,.3);
  }
  @media (max-width: 700px) {
    left: ${({ $mobileX }) => $mobileX}%; top: ${({ $mobileY }) => $mobileY}%;
    width: 2.1rem; height: 2.1rem; border-width: 2px; padding: 0.08rem;
    box-shadow: ${({ $selected }) => $selected ? "0 0 0 3px rgba(82,100,237,.18), 0 8px 16px rgba(35,54,139,.22)" : "0 5px 12px rgba(38,68,120,.18)"};
  }
`;

const MarkerCharacter = styled.img`display: block; width: 100%; height: 100%; object-fit: contain;`;

const MarkerCode = styled.span`
  position: absolute; top: -0.48rem; right: -0.46rem; min-width: 1.5rem;
  border: 2px solid white; border-radius: 999px; background: #17213f;
  padding: 0.12rem 0.27rem; color: white; font-size: 0.56rem; font-weight: 900; line-height: 1.15;
  @media (max-width: 700px) {
    top: -0.4rem; right: -0.42rem; min-width: 1.08rem;
    border-width: 1px; padding: 0.09rem 0.2rem; font-size: 0.42rem;
  }
`;

const MarkerLabel = styled.span<{ $selected: boolean }>`
  position: absolute;
  top: calc(100% + 0.28rem);
  left: 50%;
  z-index: 1;
  display: grid;
  width: max-content;
  min-width: 4.25rem;
  max-width: 9rem;
  border: 1px solid ${({ $selected }) => ($selected ? "#5264ed" : "rgba(188, 200, 230, 0.9)")};
  border-radius: 0.62rem;
  background: ${({ $selected }) => ($selected ? "#5264ed" : "rgba(255, 255, 255, 0.96)")};
  padding: 0.28rem 0.48rem 0.3rem;
  color: ${({ $selected }) => ($selected ? "#ffffff" : "#17213f")};
  line-height: 1.15;
  text-align: center;
  box-shadow: 0 6px 14px rgba(39, 58, 124, 0.16);
  transform: translateX(-50%);
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;

  strong {
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    margin-top: 0.12rem;
    color: ${({ $selected }) => ($selected ? "rgba(255,255,255,.82)" : "#7180a2")};
    font-size: 0.63rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 700px) { display: none; }
`;

const MarkerTooltip = styled.span`
  position: absolute; bottom: calc(100% + 0.72rem); left: 50%; display: grid;
  width: max-content; max-width: 10rem; border: 1px solid rgba(166, 186, 255, 0.75);
  border-radius: 0.75rem; background: rgba(255, 255, 255, 0.97); padding: 0.42rem 0.58rem;
  color: #17213f; opacity: 0; pointer-events: none;
  box-shadow: 0 10px 22px rgba(31, 50, 118, 0.18); transform: translate(-50%, 5px);
  transition: opacity 150ms ease, transform 150ms ease;
  strong { font-size: 0.76rem; } span { color: #7784a3; font-size: 0.64rem; }
  ${CountryMarker}:hover &, ${CountryMarker}:focus-visible & { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 700px) { display: none; }
`;

const CountryPanel = styled.div`
  display: grid; grid-template-columns: auto minmax(10rem, 0.7fr) minmax(17rem, 1.3fr);
  align-items: center; gap: 1rem; margin: 1rem;
  border: 1px solid rgba(166, 186, 255, 0.68); border-radius: 1.4rem;
  background: white; padding: 1rem; box-shadow: 0 16px 34px rgba(48, 74, 157, 0.09);
  animation: ${panelIn} 220ms ease both;
  @media (max-width: 820px) { grid-template-columns: auto minmax(0, 1fr); }
  @media (max-width: 520px) { margin: 0.75rem; padding: 0.85rem; }
`;

const CountryPortrait = styled.div`
  position: relative; display: grid; place-items: center; width: 5.2rem; height: 5.2rem;
  border-radius: 1.35rem; background: linear-gradient(145deg, #edf5ff, #f1ecff);
  span {
    position: absolute; right: -0.35rem; bottom: -0.3rem; border: 2px solid white;
    border-radius: 999px; background: #5264ed; padding: 0.24rem 0.42rem;
    color: white; font-size: 0.66rem; font-weight: 900;
  }
  @media (max-width: 520px) { width: 4.3rem; height: 4.3rem; }
`;

const CountryPortraitImage = styled.img`
  width: 88%; height: 88%; object-fit: contain;
`;

const CountryIdentity = styled.div`min-width: 0;`;

const CountryNames = styled.div`
  display: flex; align-items: baseline; gap: 0.55rem; flex-wrap: wrap;
  strong { color: #17213f; font-size: 2rem; font-weight: 900; line-height: 1.1; }
  span { color: #61708f; font-size: 1.15rem; font-weight: 750; }
  @media (max-width: 700px) {
    strong { font-size: 1.65rem; }
    span { font-size: 1rem; }
  }
`;

const NationalityPill = styled.div`
  display: inline-flex; align-items: center; gap: 0.38rem; margin-top: 0.45rem;
  border-radius: 999px; background: #e9fbf7; padding: 0.42rem 0.65rem;
  color: #087b70; font-size: 1rem;
  strong { font-weight: 900; } span { color: #61758d; font-weight: 700; }
  @media (max-width: 700px) { font-size: 0.88rem; }
`;

const PhraseCard = styled.div`
  border-radius: 1.05rem; background: linear-gradient(135deg, #273997, #45318e);
  padding: 0.85rem 1rem; color: white;
  p { margin: 0.2rem 0; font-size: 1.12rem; font-weight: 750; line-height: 1.55; }
  p span { display: inline-grid; place-items: center; width: 1.45rem; color: #7ef0d7; font-weight: 900; }
  p strong { color: #9af2d7; font-weight: 900; }
  small { display: block; margin-top: 0.45rem; color: rgba(255,255,255,.74); font-size: 0.9rem; line-height: 1.45; }
  @media (max-width: 820px) { grid-column: 1 / -1; }
  @media (max-width: 700px) {
    p { font-size: 0.98rem; }
    small { font-size: 0.8rem; }
  }
`;

const CountryDirectory = styled.div`
  padding: 0 1rem 1rem;
  @media (max-width: 520px) { padding: 0 0.75rem 0.75rem; }
`;

const DirectoryTitle = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  margin-bottom: 0.7rem; color: #243252;
  span { font-size: 1.08rem; font-weight: 900; }
  small { color: #7180a2; font-size: 0.86rem; font-weight: 750; }
  @media (max-width: 700px) {
    span { font-size: 1rem; }
    small { font-size: 0.8rem; }
  }
`;

const CountryTabs = styled.div`
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.55rem;
  @media (max-width: 920px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 520px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 4rem;
  }
`;

const CountryTab = styled.button<{ $selected: boolean }>`
  display: flex; align-items: center; gap: 0.55rem; min-width: 0;
  border: 1px solid ${({ $selected }) => ($selected ? "#5264ed" : "rgba(183,197,233,.75)")};
  border-radius: 0.95rem; background: ${({ $selected }) => ($selected ? "#eef1ff" : "rgba(255,255,255,.9)")};
  padding: 0.5rem 0.58rem; color: #1d2947; text-align: left; cursor: pointer;
  transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
  &:hover, &:focus-visible { border-color: #7180f5; outline: none; transform: translateY(-2px); }
  > span { display: grid; min-width: 0; }
  strong { overflow: hidden; color: #1d2947; font-size: 1rem; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
  small { overflow: hidden; color: #7180a2; font-size: 0.82rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 520px) { width: 100%; min-height: 4rem; padding: 0.45rem; }
  @media (max-width: 700px) {
    strong { font-size: 0.88rem; }
    small { font-size: 0.74rem; }
  }
`;

const CountryTabImage = styled.img`
  flex: 0 0 auto; width: 2.25rem; height: 2.25rem; object-fit: contain;
`;
