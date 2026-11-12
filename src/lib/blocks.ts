// Training blocks: the kinds a session can contain, lookup helpers and the
// factory every new block goes through (so presets can reuse it later).
import { AppData, Block, BlockKind, BlockOf, Session } from "../types";
import { CORE_PRESCRIPTION } from "./strength";

/** Every block kind, in the order the "Add a block" menu lists them. */
export const BLOCK_KINDS: { kind: BlockKind; label: string }[] = [
  { kind: "bouldering", label: "Bouldering" },
  { kind: "hangs", label: "Hangs" },
  { kind: "corehip", label: "Core/hip" },
  { kind: "pullups", label: "Pull-ups" },
];

export function blockLabel(kind: BlockKind): string {
  return BLOCK_KINDS.find((b) => b.kind === kind)?.label ?? kind;
}

/** The block of `kind` in a list of blocks, if present. */
export function findBlock<K extends BlockKind>(
  blocks: { kind: BlockKind }[],
  kind: K,
): BlockOf<K> | undefined {
  return blocks.find((b) => b.kind === kind) as BlockOf<K> | undefined;
}

/** The block of `kind` in a session, if present. */
export function getBlock<K extends BlockKind>(
  s: Session,
  kind: K,
): BlockOf<K> | undefined {
  return findBlock(s.blocks, kind);
}

export function hasBlock(s: Session, kind: BlockKind): boolean {
  return s.blocks.some((b) => b.kind === kind);
}

/** Deadlift weight from the most recent core/hip block that recorded one. */
export function lastDeadliftWeight(sessions: Session[]): number | undefined {
  return [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => getBlock(s, "corehip")?.deadlift?.weight)
    .find((w) => w != null);
}

/** A freshly added block, prefilled with sensible defaults. */
export function newBlock(kind: BlockKind, data: AppData): Block {
  switch (kind) {
    case "bouldering":
      return {
        kind,
        grades: data.grades.map((grade) => ({ grade, count: 0 })),
      };
    case "hangs":
      return {
        kind,
        edgeMm: 33,
        addedWeight: 0,
        setsIntended: 6,
        setsCompleted: 6,
      };
    case "corehip": {
      // Starts at the prescribed dose with everything ticked, so a routine
      // done as prescribed needs no input.
      const p = CORE_PRESCRIPTION;
      return {
        kind,
        breathing: true,
        deadlift: {
          sets: p.deadlift.sets,
          reps: p.deadlift.reps,
          weight: lastDeadliftWeight(data.sessions),
        },
        glutBridge: { ...p.glutBridge },
        sidePlank: { ...p.sidePlank },
      };
    }
    case "pullups":
      return { kind, sets: [] }; // the form shows one empty set to fill in
  }
}
