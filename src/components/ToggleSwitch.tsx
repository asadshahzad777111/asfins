"use client";

interface ToggleOption {
  value: string;
  label: string;
}

interface ToggleSwitchProps {
  label: string;
  options: [ToggleOption, ToggleOption];
  value: string;
  onChange: (v: string) => void;
}

export function ToggleSwitch({ label, options, value, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-charcoal">{label}</span>
      <div className="flex rounded-sm border border-divider bg-base p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-sm px-3 py-1.5 font-mono-data text-xs capitalize transition-colors ${
              value === opt.value
                ? "bg-brass text-marble"
                : "text-muted hover:text-charcoal"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
