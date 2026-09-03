import type { Language } from "./language-context";
import { words } from "./dict/words";
import { common } from "./dict/common";
import { nav } from "./dict/nav";
import { labels } from "./dict/labels";
import { profile } from "./dict/profile";
import { bantuan } from "./dict/bantuan";
import { contactPerson } from "./dict/contactPerson";
import { login } from "./dict/login";
import { ekspedisi } from "./dict/ekspedisi";
import { reject } from "./dict/reject";
import { booking } from "./dict/booking";

// Each dict module exports { id: {...}, en: {...} } with dot-namespaced keys (e.g. "nav.dashboard").
// Adding a new page/module's translations means adding one more import + one more spread below -
// keys are asserted unique across modules by TypeScript's object-literal duplicate-key check only
// within a single spread group, so keep namespaces distinct per file (nav.*, common.*, word.*, ...).
const dicts = [words, common, nav, labels, profile, bantuan, contactPerson, login, ekspedisi, reject, booking];

export const translations: Record<Language, Record<string, string>> = {
  id: Object.assign({}, ...dicts.map((d) => d.id)),
  en: Object.assign({}, ...dicts.map((d) => d.en)),
};
