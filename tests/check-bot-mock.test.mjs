import assert from "node:assert/strict";
import test from "node:test";
import { mockCheckBotReply } from "../lib/frontend/check-bot-mock.ts";

test("check bot mock cites page content without inventing prices", () => {
  const reply = mockCheckBotReply({
    pathname: "/quillfox",
    message: "What is the price?",
    pageMarkdown: "# Quillfox Pro\n\n30 days free, then USD 9.99 per month.",
  });
  assert.match(reply, /USD 9\.99/);
  assert.match(reply, /preview of the PlanMirror Auditor/i);
  assert.ok(!reply.includes("19.99"));
});

test("check bot mock handles empty page snapshots", () => {
  const reply = mockCheckBotReply({ pathname: "/audit", message: "help", pageMarkdown: "" });
  assert.match(reply, /couldn't read any page content/i);
});

const { chatPanelPosition } = await import('../lib/frontend/check-bot-position.ts');
test('chat opens toward available space at each corner and stays inside narrow viewports', () => {
  const panel = { width: 320, height: 360 };
  const viewport = { width: 1024, height: 768 };
  for (const bot of [{ x: 16, y: 16 }, { x: 952, y: 16 }, { x: 16, y: 696 }, { x: 952, y: 696 }]) {
    const position = chatPanelPosition(bot, panel, viewport);
    const x = bot.x + position.left;
    const y = bot.y + position.top;
    assert.ok(x >= 16 && x + panel.width <= viewport.width - 16);
    assert.ok(y >= 16 && y + panel.height <= viewport.height - 16);
    if (bot.y === 16) assert.ok(position.top > 0, 'top edge opens below');
    else assert.ok(position.top < 0, 'bottom edge opens above');
    if (bot.x === 16) assert.equal(position.left, 0, 'left edge opens to the right');
    else assert.ok(position.left < 0, 'right edge opens to the left');
  }
  const narrow = chatPanelPosition({ x: 16, y: 16 }, { width: 288, height: 300 }, { width: 320, height: 332 });
  assert.equal(narrow.left, 0);
  assert.equal(narrow.top, 0);
});
