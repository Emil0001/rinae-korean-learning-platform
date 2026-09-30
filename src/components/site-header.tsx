"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { useAuth } from "@/context/auth-context";
import { canAccessCourses } from "@/lib/auth/course-access";

type NavigationKind = "home" | "topik" | "courses" | "admin";

const navLinks = [
  { href: "/", label: "Главная", kind: "home" },
  { href: "/topik", label: "TOPIK", kind: "topik" },
  { href: "/courses", label: "Курсы", kind: "courses" },
  // { href: "/vocabulary", label: "Словарь" },
] satisfies Array<{ href: string; label: string; kind: NavigationKind }>;

function isNavigationLinkActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationIcon({ kind }: { kind: NavigationKind }) {
  if (kind === "admin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6.5h14M5 12h14M5 17.5h14" />
        <circle cx="9" cy="6.5" r="1.7" />
        <circle cx="15" cy="12" r="1.7" />
        <circle cx="10.5" cy="17.5" r="1.7" />
      </svg>
    );
  }

  const source =
    kind === "home" ? "/assets/45.svg" : kind === "courses" ? "/assets/46.svg" : "/assets/47.svg";

  return <NavArtwork src={source} alt="" width={40} height={40} aria-hidden="true" />;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isTopikSolvePage = /^\/topik\/[^/]+$/.test(pathname);
  const isAdminPage = pathname.startsWith("/admin");
  const shouldStick = !isTopikSolvePage && !isAdminPage;
  const canSeeAdmin = user?.role === "ADMIN";
  const canSeeCourses = canAccessCourses(user);
  const visibleNavLinks = navLinks.filter(
    (link) => link.kind !== "courses" || canSeeCourses,
  );

  const onLogout = () => {
    signOut();
    setIsMobileMenuOpen(false);
    router.push("/");
  };

  return (
    <HeaderRoot $sticky={shouldStick}>
      <Shell>
        <HeaderCard>
          <TopRow>
            <BrandLink href="/">
              <DesktopLogo src="/assets/logo.svg" alt="Rinae Korean" width={76} height={99} priority />
              <MobileLogo src="/assets/logo_mobile.png" alt="Rinae Korean" width={132} height={119} priority />
            </BrandLink>

            <DesktopNav>
              {visibleNavLinks.map((link) => (
                <NavPill
                  key={link.href}
                  href={link.href}
                  $active={isNavigationLinkActive(pathname, link.href)}
                  $kind={link.kind}
                >
                  <NavIconBadge
                    className="nav-icon"
                    $kind={link.kind}
                  >
                    <NavigationIcon kind={link.kind} />
                  </NavIconBadge>
                  <span>{link.label}</span>
                </NavPill>
              ))}
              {canSeeAdmin ? (
                <NavPill
                  href="/admin/courses"
                  $active={pathname.startsWith("/admin")}
                  $kind="admin"
                >
                  <NavIconBadge className="nav-icon" $kind="admin">
                    <NavigationIcon kind="admin" />
                  </NavIconBadge>
                  <span>Админ</span>
                </NavPill>
              ) : null}
            </DesktopNav>

            <Actions>
              {isLoading ? (
                <LoadingText>Загрузка...</LoadingText>
              ) : user ? (
                <>
                  <SecondaryPill href="/dashboard">Кабинет</SecondaryPill>
                  <DarkPillButton type="button" onClick={onLogout}>
                    Выйти
                  </DarkPillButton>
                </>
              ) : (
                <>
                  <SecondaryPill href="/auth/login">Вход</SecondaryPill>
                  <PrimaryPill href="/auth/signup">Регистрация</PrimaryPill>
                </>
              )}
            </Actions>

            <MobileMenuButton
              type="button"
              aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              <HamburgerLine $open={isMobileMenuOpen} />
              <HamburgerLine $open={isMobileMenuOpen} />
              <HamburgerLine $open={isMobileMenuOpen} />
            </MobileMenuButton>
          </TopRow>

          {isMobileMenuOpen ? (
            <MobileMenuPanel>
              <MobileNav>
                {visibleNavLinks.map((link) => (
                  <MobileNavPill
                    key={link.href}
                    href={link.href}
                    $active={isNavigationLinkActive(pathname, link.href)}
                    $kind={link.kind}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <NavIconBadge
                      className="nav-icon"
                      $kind={link.kind}
                    >
                      <NavigationIcon kind={link.kind} />
                    </NavIconBadge>
                    <span>{link.label}</span>
                    <MobileNavArrow aria-hidden="true">→</MobileNavArrow>
                  </MobileNavPill>
                ))}
                {canSeeAdmin ? (
                  <MobileNavPill
                    href="/admin/courses"
                    $active={pathname.startsWith("/admin")}
                    $kind="admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <NavIconBadge className="nav-icon" $kind="admin">
                      <NavigationIcon kind="admin" />
                    </NavIconBadge>
                    <span>Админ</span>
                    <MobileNavArrow aria-hidden="true">→</MobileNavArrow>
                  </MobileNavPill>
                ) : null}
              </MobileNav>

              <MobileActions>
                {isLoading ? (
                  <LoadingText>Загрузка...</LoadingText>
                ) : user ? (
                  <>
                    <MobileActionLink href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      Кабинет
                    </MobileActionLink>
                    <MobileLogoutButton type="button" onClick={onLogout}>
                      Выйти
                    </MobileLogoutButton>
                  </>
                ) : (
                  <>
                    <MobileSecondaryLink href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                      Вход
                    </MobileSecondaryLink>
                    <MobilePrimaryLink href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
                      Регистрация
                    </MobilePrimaryLink>
                  </>
                )}
              </MobileActions>
            </MobileMenuPanel>
          ) : null}
        </HeaderCard>
      </Shell>
    </HeaderRoot>
  );
}

const HeaderRoot = styled.header<{ $sticky: boolean }>`
  position: ${({ $sticky }) => ($sticky ? "sticky" : "relative")};
  top: ${({ $sticky }) => ($sticky ? "0" : "auto")};
  z-index: 40;
  padding: 0.3rem 0 0.2rem;

  @media (max-width: 767px) {
    top: ${({ $sticky }) => ($sticky ? "0.35rem" : "auto")};
    padding-top: max(0.35rem, env(safe-area-inset-top));
  }
`;

const Shell = styled.div`
  width: min(1400px, calc(100% - 2rem));
  margin-inline: auto;
`;

const HeaderCard = styled.div`
  border: 1px solid color-mix(in srgb, var(--line) 80%, #fff 20%);
  background: var(--surface);
  box-shadow: 0 25px 60px rgba(46, 59, 146, 0.11);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 0.4rem 0.75rem;

  @media (min-width: 768px) {
    padding: 0.5rem 1rem;
  }
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;

const BrandLink = styled(Link)`
  display: flex;
  min-width: 0;
  align-items: center;
`;

const DesktopLogo = styled(Image)`
  display: none;

  @media (min-width: 768px) {
    display: block;
  }
`;

const MobileLogo = styled(Image)`
  display: block;
  width: auto;
  height: 2.6rem;

  @media (min-width: 768px) {
    display: none;
  }
`;

const DesktopNav = styled.nav`
  display: none;
  align-items: center;
  gap: 0.3rem;

  @media (min-width: 768px) {
    display: flex;
  }
`;

const navigationColors: Record<NavigationKind, { accent: string; soft: string; shadow: string }> = {
  home: {
    accent: "#3478b8",
    soft: "#edf6ff",
    shadow: "rgba(52, 120, 184, 0.2)",
  },
  topik: {
    accent: "#7658b5",
    soft: "#f3efff",
    shadow: "rgba(118, 88, 181, 0.2)",
  },
  courses: {
    accent: "#4f55c7",
    soft: "#eef0ff",
    shadow: "rgba(79, 85, 199, 0.28)",
  },
  admin: {
    accent: "#667085",
    soft: "#f0f2f5",
    shadow: "rgba(55, 65, 81, 0.18)",
  },
};

const navigationGradientDrift = keyframes`
  0%, 100% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }
`;

const NavPill = styled(Link)<{ $active: boolean; $kind: NavigationKind }>`
  position: relative;
  display: inline-flex;
  min-height: 2.65rem;
  align-items: center;
  gap: 0.52rem;
  border: 1px solid
    ${({ $active, $kind }) =>
      $active
        ? `${navigationColors[$kind].accent}36`
        : $kind === "courses"
          ? `${navigationColors.courses.accent}1f`
          : "transparent"};
  border-radius: 9999px;
  padding: 0.34rem 0.78rem 0.34rem 0.42rem;
  color: ${({ $active, $kind }) =>
    $active ? navigationColors[$kind].accent : "var(--ink-soft)"};
  background: ${({ $active, $kind }) =>
    $active
      ? `linear-gradient(120deg, #ffffff 0%, ${navigationColors[$kind].soft} 48%, #ffffff 100%)`
      : $kind === "courses"
        ? "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(238,240,255,0.7))"
        : "transparent"};
  background-size: ${({ $active }) => ($active ? "190% 190%" : "100% 100%")};
  box-shadow: ${({ $active, $kind }) =>
    $active
      ? $kind === "courses"
        ? `0 10px 26px ${navigationColors[$kind].shadow}, 0 0 0 3px rgba(79, 85, 199, 0.035)`
        : `0 8px 20px ${navigationColors[$kind].shadow}`
      : $kind === "courses"
        ? "0 6px 17px rgba(79, 85, 199, 0.09)"
        : "none"};
  font-size: 1.1rem;
  font-weight: ${({ $kind }) => ($kind === "courses" ? 800 : 750)};
  letter-spacing: -0.012em;
  animation: ${({ $active }) =>
    $active
      ? css`
          ${navigationGradientDrift} 5.5s ease-in-out infinite
        `
      : "none"};
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  > span:last-child {
    transition: transform 180ms ease;
  }

  &:hover {
    color: ${({ $kind }) => navigationColors[$kind].accent};
    background: ${({ $kind }) =>
      `linear-gradient(135deg, #ffffff 0%, ${navigationColors[$kind].soft} 100%)`};
    border-color: ${({ $kind }) => `${navigationColors[$kind].accent}2d`};
    box-shadow: ${({ $kind }) => `0 9px 22px ${navigationColors[$kind].shadow}`};
    transform: translateY(-1px);

    .nav-icon {
      transform: scale(1.4);
    }

    > span:last-child {
      transform: translateX(1px);
    }
  }
`;

const NavIconBadge = styled.span<{ $kind: NavigationKind }>`
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 2rem;
  place-items: center;
  overflow: hidden;
  border: 0;
  border-radius: 0.45rem;
  color: ${({ $kind }) => navigationColors[$kind].accent};
  background: transparent;
  transform: scale(1.2);
  transition:
    color 180ms ease,
    transform 180ms ease;

  svg {
    width: 1.2rem;
    height: 1.2rem;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

`;

const NavArtwork = styled(Image)`
  width: 2.15rem;
  height: 2.15rem;
  max-width: none;
  object-fit: contain;
  transform: scale(1.76);
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;

  @media (max-width: 767px) {
    display: none;
  }
`;

const LoadingText = styled.span`
  font-size: 0.875rem;
  color: var(--ink-soft);
`;

const SecondaryPill = styled(Link)`
  border-radius: 9999px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.95);
  transition: border-color 160ms ease, background-color 160ms ease;
  padding: 0.35rem 0.8rem;
  font-size: 1rem;
  font-weight: 600;

  &:hover {
    border-color: var(--accent);
    background-color: #f7f8ff;
  }
`;

const PrimaryPill = styled(Link)`
  border-radius: 9999px;
  background: linear-gradient(135deg, #4d79ff 0%, #6a4dff 100%);
  color: #fff;
  box-shadow: 0 12px 26px rgba(76, 98, 255, 0.35);
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  padding: 0.35rem 0.8rem;
  font-size: 1rem;
  font-weight: 600;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 30px rgba(76, 98, 255, 0.42);
    filter: saturate(1.06);
  }
`;

const DarkPillButton = styled.button`
  border: 0;
  border-radius: 9999px;
  background: var(--surface-dark);
  color: #fff;
  padding: 0.35rem 0.8rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
`;

const MobileNav = styled.nav`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.35rem;

  @media (min-width: 768px) {
    display: none;
  }
`;

const MobileMenuButton = styled.button`
  position: relative;
  display: inline-flex;
  height: 2.75rem;
  width: 2.75rem;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  border: 1px solid var(--line-strong);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 24px rgba(76, 98, 255, 0.12);

  @media (min-width: 768px) {
    display: none;
  }
`;

const HamburgerLine = styled.span<{ $open: boolean }>`
  display: block;
  width: 1rem;
  height: 2px;
  border-radius: 9999px;
  background: var(--accent-dark);
  transition: transform 180ms ease, opacity 180ms ease;

  &:nth-child(1) {
    transform: ${({ $open }) => ($open ? "translateY(6px) rotate(45deg)" : "none")};
  }

  &:nth-child(2) {
    opacity: ${({ $open }) => ($open ? 0 : 1)};
  }

  &:nth-child(3) {
    transform: ${({ $open }) => ($open ? "translateY(-6px) rotate(-45deg)" : "none")};
  }
`;

const MobileMenuPanel = styled.div`
  margin-top: 0.65rem;
  border-top: 1px solid color-mix(in srgb, var(--line) 75%, #fff 25%);
  padding-top: 0.75rem;

  @media (min-width: 768px) {
    display: none;
  }
`;

const MobileNavPill = styled(Link)<{ $active: boolean; $kind: NavigationKind }>`
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.72rem;
  overflow: hidden;
  border: 1px solid
    ${({ $active, $kind }) =>
      $active
        ? `${navigationColors[$kind].accent}36`
        : $kind === "courses"
          ? `${navigationColors.courses.accent}1f`
          : "rgba(181, 196, 255, 0.25)"};
  border-radius: 1rem;
  padding: 0.58rem 0.72rem;
  font-size: 1.05rem;
  font-weight: 750;
  color: ${({ $active, $kind }) =>
    $active ? navigationColors[$kind].accent : "var(--ink-soft)"};
  background: ${({ $active, $kind }) =>
    $active
      ? `linear-gradient(120deg, #ffffff 0%, ${navigationColors[$kind].soft} 48%, #ffffff 100%)`
      : $kind === "courses"
        ? "linear-gradient(135deg, rgba(255,255,255,0.88), rgba(238,240,255,0.72))"
        : "rgba(255,255,255,0.72)"};
  background-size: ${({ $active }) => ($active ? "190% 190%" : "100% 100%")};
  box-shadow: ${({ $active, $kind }) =>
    $active
      ? $kind === "courses"
        ? `0 11px 28px ${navigationColors[$kind].shadow}`
        : `0 9px 22px ${navigationColors[$kind].shadow}`
      : $kind === "courses"
        ? "0 6px 17px rgba(79, 85, 199, 0.08)"
        : "none"};
  animation: ${({ $active }) =>
    $active
      ? css`
          ${navigationGradientDrift} 5.5s ease-in-out infinite
        `
      : "none"};
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  > span:nth-child(2) {
    text-align: left;
    transition: transform 180ms ease;
  }

  &:hover {
    border-color: ${({ $kind }) => `${navigationColors[$kind].accent}2d`};
    box-shadow: ${({ $kind }) => `0 9px 22px ${navigationColors[$kind].shadow}`};

    .nav-icon {
      transform: scale(1.4);
    }

    > span:nth-child(2) {
      transform: translateX(1px);
    }
  }

  &:active {
    transform: scale(0.985);
  }
`;

const MobileNavArrow = styled.span`
  color: rgba(70, 83, 132, 0.55);
  font-size: 1rem;
  transition: transform 180ms ease;

  ${MobileNavPill}:hover & {
    transform: translateX(0.18rem);
  }
`;

const MobileActions = styled.div`
  margin-top: 0.75rem;
  display: grid;
  gap: 0.5rem;

  @media (min-width: 768px) {
    display: none;
  }
`;

const MobileActionLink = styled(Link)`
  border-radius: 9999px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.95);
  padding: 0.8rem 1rem;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 600;
`;

const MobileSecondaryLink = styled(MobileActionLink)``;

const MobilePrimaryLink = styled(Link)`
  border-radius: 9999px;
  background: linear-gradient(135deg, #4d79ff 0%, #6a4dff 100%);
  color: #fff;
  box-shadow: 0 12px 26px rgba(76, 98, 255, 0.28);
  padding: 0.8rem 1rem;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
`;

const MobileLogoutButton = styled.button`
  border: 0;
  border-radius: 9999px;
  background: var(--surface-dark);
  color: #fff;
  padding: 0.8rem 1rem;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
`;
