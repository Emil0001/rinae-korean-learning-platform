import ResetPasswordForm from "./reset-password-form";

type ResetPasswordPageProps = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = params?.token?.trim() ?? "";

  return <ResetPasswordForm token={token} />;
}
