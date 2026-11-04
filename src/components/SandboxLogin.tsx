import { connection } from "next/server";
import { sandboxBuyerLogin } from "@/lib/sandbox-login";
import { giftText, type Lang } from "@/lib/i18n/gift";

/** The sandbox buyer login, shown where a judge needs it: next to the PayPal buttons and on the judges' path. */
export async function SandboxLogin({ compact, lang = "en" }: { compact?: boolean; lang?: Lang }) {
  const t = giftText(lang);
  await connection();
  const login = await sandboxBuyerLogin();
  if (!login) {
    return (
      <p className="sbl-missing">
        Use the PayPal sandbox buyer login in the project&rsquo;s{" "}
        <a className="text-link" href="https://github.com/usv240/giftwise/blob/main/TESTING.md#paypal-sandbox-buyer-login">
          TESTING.md
        </a>
        .
      </p>
    );
  }
  return (
    <dl className="sbl" data-compact={compact ? "" : undefined}>
      <div>
        <dt>{t.sandboxEmail}</dt>
        <dd>
          <code>{login.email}</code>
        </dd>
      </div>
      <div>
        <dt>{t.password}</dt>
        <dd>
          <code>{login.password}</code>
        </dd>
      </div>
    </dl>
  );
}
