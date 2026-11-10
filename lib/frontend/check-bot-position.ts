type Point = { x: number; y: number };
type Size = { width: number; height: number };
export const CHECK_BOT_SIZE = 56;

/** Choose an available side, then constrain the complete panel to the viewport. */
export function chatPanelPosition(bot: Point, panel: Size, viewport: Size, botSize = CHECK_BOT_SIZE) {
  const margin = 16;
  const gap = 12;
  const maxX = Math.max(margin, viewport.width - panel.width - margin);
  const maxY = Math.max(margin, viewport.height - panel.height - margin);
  const alignedLeft = bot.x + botSize - panel.width;
  const x = Math.min(maxX, Math.max(margin, alignedLeft >= margin ? alignedLeft : bot.x));
  const above = bot.y - gap - panel.height;
  const below = bot.y + botSize + gap;
  const y = Math.min(maxY, Math.max(margin, above >= margin ? above : below));
  return { left: x - bot.x, top: y - bot.y };
}
