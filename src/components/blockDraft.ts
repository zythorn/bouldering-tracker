// Blocks as the session form edits them: number fields may be empty while
// typing. toDraft() prepares a saved block for editing; fromDraft() turns it
// back into a block to save (or drops it when there's nothing to keep).
import {
  Block,
  BoulderBlock,
  CoreHipBlock,
  GradeCount,
  SessionType,
} from "../types";

export interface HangDraft {
  kind: "hangs";
  edgeMm?: number;
  addedWeight?: number;
  setsIntended?: number;
  setsCompleted?: number;
  typeOverride?: SessionType;
}

export interface PullupSetDraft {
  reps?: number;
  addedWeight?: number;
}

export interface PullupDraft {
  kind: "pullups";
  sets: PullupSetDraft[];
}

export type DraftBlock = BoulderBlock | CoreHipBlock | HangDraft | PullupDraft;

/** Merge the configured grade list with any counts already on the block. */
function mergeGrades(grades: string[], existing: GradeCount[]): GradeCount[] {
  const byGrade = new Map(existing.map((g) => [g.grade, g.count]));
  const base = grades.map((g) => ({ grade: g, count: byGrade.get(g) ?? 0 }));
  // Keep any grades on the block that aren't in the current config list.
  for (const g of existing) {
    if (!grades.includes(g.grade)) base.push({ ...g });
  }
  return base;
}

export function toDraft(block: Block, grades: string[]): DraftBlock {
  switch (block.kind) {
    case "bouldering":
      return { ...block, grades: mergeGrades(grades, block.grades) };
    case "pullups":
      // A new pull-ups block starts with one empty set to fill in.
      return { ...block, sets: block.sets.length ? block.sets : [{}] };
    default:
      return block;
  }
}

export function fromDraft(d: DraftBlock): Block | undefined {
  switch (d.kind) {
    case "bouldering":
      return {
        kind: "bouldering",
        grades: d.grades.filter((g) => g.count > 0),
        boulders: d.boulders?.length ? d.boulders : undefined,
      };
    case "hangs":
      // Same rule as before blocks: no edge or intended sets, no hang entry.
      if (d.edgeMm == null || d.setsIntended == null) return undefined;
      return {
        kind: "hangs",
        edgeMm: d.edgeMm,
        addedWeight: d.addedWeight ?? 0,
        setsIntended: d.setsIntended,
        setsCompleted: d.setsCompleted ?? 0,
        typeOverride: d.typeOverride,
      };
    case "pullups": {
      const sets = d.sets
        .filter((s) => s.reps != null)
        .map((s) => ({
          reps: s.reps!,
          addedWeight: s.addedWeight ? s.addedWeight : undefined,
        }));
      return sets.length ? { kind: "pullups", sets } : undefined;
    }
    case "corehip":
      return d;
  }
}
