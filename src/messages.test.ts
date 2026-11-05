import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import es from "./messages/es.json";

type Tree = { [key: string]: Tree | string };

/** "a.b.c" for every string in the tree. */
const leaves = (tree: Tree, prefix = ""): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else leaves(value, path).forEach((v, k) => out.set(k, v));
  }
  return out;
};

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)(?:,[^}]*)?\}/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<(\/?\w+)>/g)].map((m) => m[1]).sort();

const english = leaves(en as Tree);
const spanish = leaves(es as Tree);

describe("translations", () => {
  it("have the same keys in English and Spanish", () => {
    const missingInSpanish = [...english.keys()].filter((k) => !spanish.has(k));
    const missingInEnglish = [...spanish.keys()].filter((k) => !english.has(k));
    expect({ missingInSpanish, missingInEnglish }).toEqual({ missingInSpanish: [], missingInEnglish: [] });
  });

  it("have no empty strings", () => {
    const empty = [...english, ...spanish].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("use the same {placeholders} in both languages", () => {
    const mismatched = [...english.keys()]
      .filter((k) => spanish.has(k))
      .filter((k) => placeholders(english.get(k)!).join() !== placeholders(spanish.get(k)!).join());
    expect(mismatched).toEqual([]);
  });

  it("use the same rich-text tags in both languages", () => {
    const mismatched = [...english.keys()]
      .filter((k) => spanish.has(k))
      .filter((k) => tags(english.get(k)!).join() !== tags(spanish.get(k)!).join());
    expect(mismatched).toEqual([]);
  });
});
