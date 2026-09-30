// 场景：Open Dots 侧栏/命令图标 — 简化品牌点阵标（无上游 favicon 时）。
import { createElement, type ReactElement } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export function OpenDotsIcon(props: {
  size?: number;
  color?: string;
}): ReactElement {
  const size = props.size ?? 18;
  return createElement(
    Svg,
    { width: size, height: size, viewBox: "0 0 64 64", accessibilityLabel: "Open Dots" },
    createElement(Rect, { width: 64, height: 64, rx: 14, fill: "#0F172A" }),
    createElement(Circle, { cx: 22, cy: 32, r: 7, fill: "#38BDF8" }),
    createElement(Circle, { cx: 42, cy: 22, r: 5, fill: "#A78BFA" }),
    createElement(Circle, { cx: 42, cy: 42, r: 5, fill: "#34D399" }),
    createElement(Path, {
      d: "M28 32h8M38 25l-4 7 4 7",
      stroke: "#E2E8F0",
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      fill: "none",
    }),
  );
}
