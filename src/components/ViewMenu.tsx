"use client";

import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useState } from "react";
import { Info } from "./Info";
import { usePrefs, type Prefs } from "./prefs";

type Option<K extends keyof Prefs> = { value: Prefs[K]; label: string };

function Segmented<K extends keyof Prefs>({ name, label, options, infoId }: { name: K; label: string; options: Option<K>[]; infoId: string }) {
  const { prefs, set } = usePrefs();
  return (
    <fieldset className="view-row">
      <legend className="view-legend">
        {label} <Info id={infoId} label="" />
      </legend>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={String(o.value)} className="seg-opt" data-on={prefs[name] === o.value ? "" : undefined}>
            <input type="radio" name={`pref-${String(name)}`} value={String(o.value)} checked={prefs[name] === o.value} onChange={() => set(name, o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ViewMenu() {
  const [open, setOpen] = useState(false);
  const {
    refs: { setReference, setFloating },
    floatingStyles,
    context,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([useClick(context), useDismiss(context), useRole(context, { role: "dialog" })]);

  return (
    <>
      <button ref={setReference} type="button" className="btn btn-quiet view-btn" aria-expanded={open} {...getReferenceProps()}>
        View
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div ref={setFloating} style={floatingStyles} className="view-pop" aria-label="View settings" {...getFloatingProps()}>
              <Segmented
                name="mode"
                label="Explanations"
                infoId="view.mode"
                options={[
                  { value: "plain", label: "Plain" },
                  { value: "technical", label: "Technical" },
                ]}
              />
              <Segmented
                name="labels"
                label="Info labels"
                infoId="view.labels"
                options={[
                  { value: "on", label: "Show" },
                  { value: "off", label: "Hide" },
                ]}
              />
              <Segmented
                name="theme"
                label="Theme"
                infoId="view.theme"
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
              />
              <Segmented
                name="text"
                label="Text size"
                infoId="view.text"
                options={[
                  { value: "standard", label: "Standard" },
                  { value: "large", label: "Large" },
                ]}
              />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
