import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginRedirect({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params?.redirect) {
    query.set("redirect", String(params.redirect));
  }

  redirect(query.toString() ? `/?${query.toString()}` : "/");
}