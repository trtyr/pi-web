import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./Dialog.tsx", import.meta.url), "utf8");
const shellSource = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const agentsSource = await readFile(new URL("./AgentsConfig.tsx", import.meta.url), "utf8");
const en = await readFile(new URL("../lib/i18n/messages/en.ts", import.meta.url), "utf8");
const zhCN = await readFile(new URL("../lib/i18n/messages/zh-CN.ts", import.meta.url), "utf8");
const zhTW = await readFile(new URL("../lib/i18n/messages/zh-TW.ts", import.meta.url), "utf8");

test("dialog system exposes promise-based confirm, alert and prompt", () => {
  assert.match(source, /confirm: \(options: DialogConfirmOptions\) => Promise<boolean>/);
  assert.match(source, /alert: \(options: DialogAlertOptions\) => Promise<void>/);
  assert.match(source, /prompt: \(options: DialogPromptOptions\) => Promise<string \| null>/);
  assert.match(source, /export function useDialogs/);
  assert.match(source, /export function DialogsProvider/);
});

test("dialogs follow the shared panel design language", () => {
  assert.match(source, /zIndex: 1100/);
  assert.match(source, /var\(--bg-panel\)/);
  assert.match(source, /var\(--border\)/);
  assert.match(source, /0 12px 36px rgba\(0,0,0,0\.24\)/);
});

test("danger tone gets destructive styling and the safe action gets focus", () => {
  assert.match(source, /#ef4444/);
  assert.match(source, /tone === "danger" \? cancelRef\.current : confirmRef\.current/);
});

test("dialogs close on Escape in capture phase and guard against double resolution", () => {
  assert.match(source, /document\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(source, /"Escape"/);
  assert.match(source, /if \(!head \|\| head\.settled\) return;/);
});

test("provider is mounted at the app shell root", () => {
  assert.match(shellSource, /<DialogsProvider>/);
  assert.match(shellSource, /<\/DialogsProvider>/);
});

test("agents delete uses the themed dialog instead of window.confirm", () => {
  assert.doesNotMatch(agentsSource, /window\.confirm/);
  assert.match(agentsSource, /const dialogs = useDialogs\(\)/);
  assert.match(agentsSource, /await dialogs\.confirm\(\{/);
});

test("dialog i18n keys exist in every built-in locale", () => {
  for (const locale of [en, zhCN, zhTW]) {
    assert.match(locale, /"common\.cancel":/);
    assert.match(locale, /"agents\.deleteTitle":/);
  }
});
