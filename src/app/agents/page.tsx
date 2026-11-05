import type { Metadata } from "next";
import Link from "next/link";
import recorded from "../../../content/agent-demo.json";
import { Info } from "@/components/Info";
import { AgentDemo, type AgentRun } from "@/components/agents/AgentDemo";
import { CopyButton } from "@/components/developers/CopyButton";
import { TOOLS } from "@/lib/mcp/tools";
import "../pages.css";
import "../developers/dev.css";
import "./agents.css";
import { HOSTED_URL } from "@/lib/origin";

export const metadata: Metadata = { title: "For AI agents", description: "Giftwise's MCP server: AI assistants check a gift before giving to someone on SSI, and prepare a PayPal checkout only the giver can approve." };

const HOST = (process.env.RENDER_EXTERNAL_URL || HOSTED_URL).replace(/\/$/, "");

/** One client: its name, how to add Giftwise, and the command to copy when there is one. */
function Client({ name, command, label, children }: { name: string; command?: string; label?: string; children?: React.ReactNode }) {
  return (
    <div className="ag-client">
      <div className="ag-client-head">
        <h3>{name}</h3>
        {command && <CopyButton text={command} label="Copy" />}
      </div>
      {children}
      {command && (
        <pre className="dev-pre tabular" tabIndex={0} aria-label={label}>
          {command}
        </pre>
      )}
    </div>
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
        <Client name="Claude on the web or Claude Desktop">
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
      </section>

      <section className="page-section" aria-labelledby="tools-h">
        <h2 id="tools-h">Tools</h2>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Giftwise MCP tools">
          <table className="doc-table ag-tools">
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">What it does</th>
                <th scope="col">Changes anything</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name}>
                  <td>
                    <code>{t.name}</code>
                  </td>
                  <td>{t.description}</td>
                  <td>{t.annotations.readOnlyHint ? "No" : (t.changes ?? "Yes")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <Link className="text-link" href="/judges#failure-cases">
              the failure cases
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
