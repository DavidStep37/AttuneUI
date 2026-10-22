import { parseMotionTokens } from "../workbench/model";

/**
 * Sample: the design team's motion tokens (缓动 / 持续时间 table), in the W3C-style shape the
 * workbench accepts. Paste the same JSON into “加载 Token”, or pass it as `tokenLibrary`.
 */
export const designTeamTokensJSON = {
  name: "设计组 Motion Token",
  Easing: {
    easeIn: { $value: [0.32, 0, 0.67, 0], $description: "通用加速" },
    easeOut: { $value: [0.33, 1, 0.68, 1], $description: "通用减速" },
    easeInOut: { $value: [0.65, 0, 0.35, 1], $description: "缓进缓出" },
    linear: { $value: [0, 0, 1, 1], $description: "线性" },
  },
  Duration: {
    "short-1": "100ms", "short-2": "150ms", "short-3": "200ms", "short-4": "250ms", "short-5": "300ms",
    "medium-1": "400ms", "medium-2": "500ms", "medium-3": "600ms", "medium-4": "700ms", "medium-5": "800ms",
    "long-1": "1000ms", "long-2": "2000ms", "long-3": "3000ms", "long-4": "4000ms", "long-5": "5000ms",
  },
};

export const designTeamTokens = parseMotionTokens(designTeamTokensJSON);
