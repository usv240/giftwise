import { sandboxBuyerLogin } from "@/lib/sandbox-login";
import { giftText, type Lang } from "@/lib/i18n/gift";

/** The sandbox buyer login, shown next to the PayPal buttons and on the Evidence page. */
export function SandboxLogin({ compact, lang = "en" }: { compact?: boolean; lang?: Lang }) {
  const t = giftText(lang);
  const login = sandboxBuyerLogin();
  if (!login) {
    return <p className="sbl-missing">The sandbox buyer login is not available on this build. Any PayPal sandbox buyer account works in the checkout window.</p>;
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
