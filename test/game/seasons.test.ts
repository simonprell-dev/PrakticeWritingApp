// Every seasonal world that is built passes the shared checks (test/helpers/seasonCheck.ts).
import { describe, expect, it } from "vitest";
import { SEASON_IDS, SEASON_INFO } from "../../src/app/worlds.ts";
import { SEASON_DEFS } from "../../src/scenes/seasons/index.ts";
import { checkSeasonWorld } from "../helpers/seasonCheck.ts";

describe("seasonal worlds", () => {
  it("every seasonal world has its tile text", () => {
    for (const id of SEASON_IDS)
      expect(SEASON_INFO[id].title.length).toBeGreaterThan(0);
  });

  for (const [id, def] of Object.entries(SEASON_DEFS))
    checkSeasonWorld(id, def);
});
