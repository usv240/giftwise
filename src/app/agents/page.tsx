import type { Metadata } from "next";
import Link from "next/link";
import recorded from "../../../content/agent-demo.json";
import { Info } from "@/components/Info";
import { AgentDemo, type AgentRun } from "@/components/agents/AgentDemo";
import { TOOLS } from "@/lib/mcp/tools";
import "../pages.css";
import "../developers/dev.css";
import "./agents.css";

export const metadata: Metadata = { title: "For AI agents", description: "Giftwise's MCP server: AI assistants check a gift before giving to someone on SSI, and prepare a PayPal checkout only the giver can approve." };

const HOST = (process.env.RENDER_EXTERNAL_URL || "https://giftwise.onrender.com").replace(/\/$/, "");

export default function AgentsPage() {
  const url = `${HOST}/api/mcp`;
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
      </header>

      <section className="page-section" aria-labelledby="demo-h">
        <div className="title-row">
          <h2 id="demo-h">An assistant that asks first</h2>
          <Info id="agents.demo" label="" />
        </div>
        <p className="page-prose">A Claude assistant that knows nothing about SSI, connected to Giftwise only through the MCP server below. Every tool it calls goes over MCP.</p>
        <AgentDemo recorded={recorded as AgentRun} />
      </section>

      <section className="page-section" aria-labelledby="connect-h">
        <div className="title-row">
          <h2 id="connect-h">Connect your agent</h2>
          <Info id="agents.connect" label="" />
        </div>
        <p className="page-prose">
          Streamable HTTP at <code>{url}</code>. No key needed in the sandbox.
        </p>
        <p className="ag-k">Claude Code</p>
        <pre className="dev-pre tabular" tabIndex={0} aria-label="Command to add Giftwise to Claude Code">{`claude mcp add --transport http giftwise ${url}`}</pre>
        <p className="ag-k">Other MCP clients</p>
        <pre className="dev-pre tabular" tabIndex={0} aria-label="MCP client configuration">{JSON.stringify({ mcpServers: { giftwise: { type: "http", url } } }, null, 2)}</pre>
      </section>

      <section className="page-section" aria-labelledby="tools-h">
        <h2 id="tools-h">Tools</h2>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Giftwise MCP tools">
          <table className="doc-table">
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
                  <td className="tabular">{t.name}</td>
                  <td>{t.description}</td>
                  <td>{t.annotations.readOnlyHint ? "No" : "Creates a sandbox order; nothing is charged until the giver approves"}</td>
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
