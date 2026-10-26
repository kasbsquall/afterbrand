import { ArrowRight, CaretLeft, Flask, SpeakerHigh, SpeakerSlash, Swap } from "@phosphor-icons/react";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { Link } from "react-router";

import { formatDate } from "./shared";

type Props = {
  decided?: number;
  all?: number;
  muted: boolean;
  onToggleMute: () => void;
  crumb?: { to: string; label: string; current: string };
};

function StrataMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="2" y="2" width="4" height="18" rx="2" fill="oklch(42% .02 200)" />
      <rect x="2" y="2" width="4" height="9" rx="2" fill="oklch(78% .13 75)" />
      <rect x="9" y="2" width="4" height="13" rx="2" fill="oklch(42% .02 200)" />
      <rect x="9" y="2" width="4" height="5" rx="2" fill="oklch(70% .07 180)" />
      <rect x="16" y="2" width="4" height="16" rx="2" fill="oklch(78% .13 75)" />
    </svg>
  );
}

export function TopBar({ decided, all, muted, onToggleMute, crumb }: Props) {
  const { data } = useActionQuery("list-rules", {});
  const rules = (data?.rules ?? []).filter((r) => r.enabled);
  const ratio = all && decided !== undefined ? decided / all : 0;

  return (
    <header className="ab-top">
      <div className="ab-brand" aria-hidden="true">
        <StrataMark />
      </div>
      {crumb ? (
        <div className="ab-crumb">
          <Link to={crumb.to}>
            <CaretLeft size={14} weight="light" />
            {crumb.label}
          </Link>
          <span>{crumb.current}</span>
        </div>
      ) : null}
      <div className="ab-top-end">
        {rules.map((rule, i) => (
          <span
            key={rule.id}
            className={`ab-rule${i > 0 ? " ab-rule-second" : ""}`}
            title={`Effective ${formatDate(rule.effectiveDate)}`}
          >
            <Swap size={13} weight="light" />
            {rule.oldName}
            <ArrowRight size={13} weight="light" />
            <b>{rule.newName}</b>
          </span>
        ))}
        {all !== undefined && decided !== undefined ? (
          <div className="ab-progress">
            <div className="ab-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${ratio})` }} />
            </div>
            <span>
              <strong>{decided}</strong> of {all} <span className="ab-long">findings decided by the agent</span>
            </span>
          </div>
        ) : null}
        <span className="ab-demo" title="Public Builder.io blog posts, snapshot of Oct 25, 2026">
          <Flask size={13} weight="light" />
          Demo data
        </span>
        <button
          type="button"
          className="ab-icon-btn"
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Turn sounds on" : "Mute sounds"}
          title={muted ? "Sounds off" : "Sounds on"}
        >
          {muted ? <SpeakerSlash size={16} weight="light" /> : <SpeakerHigh size={16} weight="light" />}
        </button>
      </div>
    </header>
  );
}
