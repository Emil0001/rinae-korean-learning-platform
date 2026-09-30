import Image from "next/image";
import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Главная" },
  { href: "/topik", label: "TOPIK" },
  // { href: "/courses", label: "Курсы" },
];

export function SiteFooter() {
  return (
    <footer className="pb-8 pt-14">
      <div className="site-shell">
        <div className="glass-card rounded-3xl border border-[#d5deff] px-6 py-8 md:px-10 md:py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <Image
                src="/assets/logo.svg"
                alt="Rinae Korean"
                width={112}
                height={146}
              />
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#5a648d]">
                Современная платформа для изучения корейского языка и подготовки
                к TOPIK.
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mt-3 flex flex-wrap justify-start gap-2">
                {footerLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-[#aab8ff] bg-white/70 px-5 py-2.5 text-base font-semibold text-[#1f2c62] transition-colors hover:border-[#5a6cff] hover:bg-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-end justify-start gap-4">
                <Link
                  href="https://t.me/koreawithrinae"
                  target="_blank"
                  className="flex h-[72px] w-[72px] items-center justify-center"
                >
                  <Image
                    src="/assets/19.svg"
                    alt="Telegram"
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] object-contain"
                  />
                </Link>

                <Link
                  href="https://www.instagram.com/rinae_korean/?next=%2Frinae.me%2F"
                  target="_blank"
                  className="flex h-[72px] w-[72px] items-center justify-center"
                >
                  <Image
                    src="/assets/20.svg"
                    alt="Instagram"
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] object-contain"
                  />
                </Link>

                {/* <Link
                  href=""
                  target="_blank"
                  className="flex h-[72px] w-[72px] items-center justify-center"
                >
                  <Image
                    src="/assets/21.svg"
                    alt="YouTube"
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] object-contain"
                  />
                </Link> */}
              </div>
            </div>

            <div>
              <p className="text-sm font-black tracking-[0.1em] text-[#1b275a] uppercase">
                Контакты
              </p>
              <p className="mt-3 text-sm text-[#5a648d]">
                Telegram: @rinae_korean
              </p>
              <p className="mt-1 text-sm text-[#5a648d]">
                Email: emil.nigay@gmail.com
              </p>
              <Link
                href="/auth/signup"
                className="primary-btn mt-4 inline-flex px-6 py-2.5 text-base font-semibold"
              >
                Оставить заявку
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-[#d5deff] pt-4">
            <p className="text-xs text-[#6a76a6]">
              © {new Date().getFullYear()} Rinae Korean. Все права защищены.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
