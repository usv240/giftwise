import type { Metadata } from "next";
import Link from "next/link";
import recorded from "../../../content/agent-demo.json";
import { Info } from "@/components/Info";
import { AgentDemo, type AgentRun } from "@/components/agents/AgentDemo";
import { CopyButton } from "@/components/developers/CopyButton";
import { TOOLS } from "@/lib/mcp/tools";
import "../pages.css";
import "../developers/dev.css";
import "../learn/disclosure.css";
import "./agents.css";
import { HOSTED_URL } from "@/lib/origin";

export const metadata: Metadata = { title: "For AI agents", description: "Giftwise's MCP server: AI assistants check a gift before giving to someone on SSI, and prepare a PayPal checkout only the giver can approve." };

const HOST = (process.env.RENDER_EXTERNAL_URL || HOSTED_URL).replace(/\/$/, "");

/** One tool's job in a line; the full description an agent reads opens below it. A tool not listed here shows its description. */
const TOOL_JOBS: Record<string, string> = {
  check_gift: "How one gift changes the SSI check, and the benefit-safe way to give it.",
  get_gift_page: "Reads a gift page: who it is for, what is still needed, and who gets paid.",
  ask_rulebook: "Answers a question about SSI and gifts from the rule text, with every quote checked.",
  find_gift: "Finds real products for a need and checks each one against the SSI rules.",
  plan_gift: "Splits any amount across a page's needs and the ABLE account, compared with cash.",
  review_bill: "Two reviewers decide whether a bill counts as housing under SSI rules.",
  get_ssa_report: "Writes one month's report to Social Security from the gifts themselves.",
  start_gift_checkout: "Prepares a PayPal checkout that pays each recipient directly, for the giver to approve.",
  start_monthly_gift: "Sets up the same gift every month; the giver approves each month in PayPal.",
};

/**
 * One client: its name, how to add Giftwise, and the command to copy when there is one. The clients share a name, so
 * opening one closes the one before: one set of steps on screen at a time.
 */
function Client({ name, command, label, open, children }: { name: string; command?: string; label?: string; open?: boolean; children?: React.ReactNode }) {
  return (
    <details className="dsc ag-client" name="ag-connect" open={open}>
      <summary>
        <h3 className="dsc-k">{name}</h3>
      </summary>
      <div className="ag-client-body">
        {children}
        {command && (
          <div className="ag-cmd">
            <pre className="dev-pre tabular" tabIndex={0} aria-label={label}>
              {command}
            </pre>
            <CopyButton text={command} label="Copy" />
          </div>
        )}
      </div>
    </details>
  );
}

export default function AgentsPage() {
  const url = `${HOST}/api/mcp`;
  const claudeCode = `claude mcp add --transport http giftwise ${url}`;
  const vsCode = `code --add-mcp '${JSON.stringify({ name: "giftwise", type: "http", url })}'`;
  const config = JSON.stringify({ mcpServers: { giftwise: { type: "http", url } } }, null, 2);
  return (
    <div className="page frame agents">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">For AI agents</h1>
          <Info id="page.agents" />
        </div>
        <p className="lede">
          Assistants that shop and give for people need one more check: will this gift lower someone&rsquo;s SSI check? Giftwise answers over MCP, and can prepare a PayPal checkout that
          only the giver can approve.
        </p>
        <div className="ag-url" data-ui>
          <p className="ag-url-k">MCP server</p>
          <code className="ag-url-code tabular">{url}</code>
          <div className="ag-url-actions">
            <CopyButton text={url} label="Copy address" />
            <a className="text-link" href="#connect">
              Connect your agent
            </a>
          </div>
        </div>
      </header>

      <section className="page-section" aria-labelledby="demo-h">
        <div className="title-row">
          <h2 id="demo-h">An assistant that asks first</h2>
          <Info id="agents.demo" label="" />
        </div>
        <p className="page-prose">
          A Claude assistant that knows nothing about SSI, connected to Giftwise only through the MCP server below. After it starts the checkout, it reads the order back from PayPal, so June hears what
          PayPal will pay.
          <span className="ag-tech">
            {" "}
            It asks PayPal&rsquo;s own MCP server first (its get_order tool, from PayPal&rsquo;s @paypal/mcp package, which Giftwise runs) and reads PayPal&rsquo;s Orders API when that server cannot run
            the call.
          </span>
        </p>
        <AgentDemo recorded={recorded as AgentRun} />
      </section>

      <section id="connect" className="page-section ag-connect" aria-labelledby="connect-h">
        <div className="title-row">
          <h2 id="connect-h">Connect your agent</h2>
          <Info id="agents.connect" label="" />
        </div>
        <p className="page-prose">
          Streamable HTTP at <code>{url}</code>. No key needed in the sandbox.
        </p>
        <div className="ag-clients">
          <Client name="Claude on the web or Claude Desktop" open>
            <p className="page-prose">
              Settings, then Connectors, then Add custom connector. Name it Giftwise and paste <code>{url}</code>.
            </p>
          </Client>
          <Client name="Claude Code" command={claudeCode} label="Command to add Giftwise to Claude Code" />
          <Client name="Cursor">
            <div className="ag-cursor">
              <a className="btn btn-quiet" href={`cursor://anysphere.cursor-deeplink/mcp/install?name=giftwise&config=${Buffer.from(JSON.stringify({ url })).toString("base64")}`}>
                Add to Cursor
              </a>
              <p>Cursor shows the server and its address before anything is added.</p>
            </div>
          </Client>
          <Client name="VS Code" command={vsCode} label="Command to add Giftwise to VS Code" />
          <Client name="Other MCP clients" command={config} label="MCP client configuration" />
          <Client name="Found without being told">
            <p className="page-prose">
              An agent pointed at this site can find the server on its own: the domain&rsquo;s AI Catalog at <code>/.well-known/ai-catalog.json</code> lists its MCP Server Card at{" "}
              <code>{url}/server-card</code>, the discovery format MCP adopted in SEP-2127, and <code>/llms.txt</code> describes Giftwise in plain text.
            </p>
          </Client>
        </div>
      </section>

      <section className="page-section" aria-labelledby="tools-h">
        <h2 id="tools-h">Tools</h2>
        <p className="page-prose">{TOOLS.length} tools, each with its job. Each one opens to the full description an agent reads, and whether it changes anything.</p>
        <ul className="ag-tools">
          {TOOLS.map((t) => (
            <li key={t.name}>
              <details className="dsc ag-tool-row">
                <summary>
                  <code className="ag-tool-name">{t.name}</code>
                  <span className="ag-tool-job dsc-k">{TOOL_JOBS[t.name] ?? t.description}</span>
                  {!t.annotations.readOnlyHint && <span className="dev-tag ag-tool-tag">Changes something</span>}
                </summary>
                <div className="ag-tool-body">
                  <p>{t.description}</p>
                  <p className="muted">Changes anything: {t.annotations.readOnlyHint ? "No" : (t.changes ?? "Yes")}</p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-section" aria-labelledby="limits-h">
        <h2 id="limits-h">What an agent can and cannot do</h2>
        <ul className="page-prose ag-rules">
          <li>It can check any gift, read a gift page, plan a gift and ask the two reviewers.</li>
          <li>It can prepare a PayPal checkout. Only the person giving can approve it, in PayPal, and Giftwise captures the payment only after that.</li>
          <li>It can set up a monthly gift. The giver still approves each month in PayPal, on their own page; nothing is ever charged on its own.</li>
          <li>It never chooses where money goes: the rules engine does, for every dollar.</li>
          <li>
            Every checkout an agent starts is written to the same ledger as everything else, marked as made by an agent. See{" "}
            <Link className="text-link" href="/evidence#failure-cases">
              the failure cases
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
