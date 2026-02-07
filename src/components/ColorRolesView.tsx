"use client";

import { useState } from "react";
import { ColorRoleAnalysis } from "@/lib/audit/types";

interface Props {
  data: ColorRoleAnalysis;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function RoleStrip({
  colors,
}: {
  colors: { hex: string; count: number; name: string }[];
}) {
  const [hovered, setHovered] = useState<{
    hex: string;
    count: number;
    name: string;
  } | null>(null);

  const sorted = [...colors]
    .slice(0, 20)
    .sort((a, b) => luminance(b.hex) - luminance(a.hex));

  return (
    <div className="space-y-1.5">
      <div className="flex h-10 rounded-lg overflow-hidden border border-black/[0.06]">
        {sorted.map((c, i) => (
          <div
            key={`${c.hex}-${i}`}
            className={`h-full cursor-default transition-opacity duration-150 ${
              hovered && hovered.hex !== c.hex ? "opacity-40" : ""
            }`}
            style={{
              backgroundColor: c.hex,
              flex: `${Math.max(c.count, 1)} 0 0%`,
              minWidth: "8px",
            }}
            onMouseEnter={() => setHovered(c)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </div>
      <div className="h-4">
        {hovered && (
          <div className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-sm border border-black/10 shrink-0"
              style={{ backgroundColor: hovered.hex }}
            />
            <span className="font-mono text-ds-secondary">{hovered.hex}</span>
            <span className="text-ds-tertiary">{hovered.name}</span>
            <span className="text-ds-tertiary">×{hovered.count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ColorRolesView({ data }: Props) {
  if (data.roles.length === 0) return null;

  return (
    <div className="border-t border-border pt-5 pb-6">
      <p className="text-sm text-ds-tertiary font-medium mb-5">Color Roles</p>

      <div className="space-y-5">
        {data.roles.map((role) => (
          <div key={role.role} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ds-secondary font-medium capitalize">
                {role.label}
              </span>
              <span className="text-xs text-ds-tertiary font-mono">
                {role.colors.length}
              </span>
            </div>
            <RoleStrip colors={role.colors} />
          </div>
        ))}
      </div>

      {data.inconsistencies.length > 0 && (
        <div className="mt-4 space-y-1">
          {data.inconsistencies.map((note, i) => (
            <p key={i} className="text-xs text-ds-amber font-medium">
              ⚠ {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
