import { STAGES } from "@/lib/resources";

/** The seven production stages in panel order (spec 06): Cut, Sow, Frame, Media, Wire, Package, Assemble. */
export const STAGE_NAMES = STAGES.map(([name]) => name);
export type StageFlags = Record<string, boolean>;

/** The category's `show_<stage>` columns, as SQL select items (code constants only). */
export const STAGE_FLAG_SELECT = (alias: string) => STAGE_NAMES.map((n) => `${alias}.show_${n}`).join(", ");

/** Pulls the `show_<stage>` columns out of a row into `{ <stage>: boolean }`. */
export function takeStageFlags(row: Record<string, unknown>): StageFlags {
  const flags: StageFlags = {};
  for (const n of STAGE_NAMES) {
    flags[n] = row[`show_${n}`] === true;
    delete row[`show_${n}`];
  }
  return flags;
}

export { isId } from "@/lib/ids";
