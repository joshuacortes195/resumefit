"use client";

import { useSearchParams } from "next/navigation";
import { Board } from "@/components/tracker/board";
import type { BoardJob } from "@/lib/data/jobs";

// shows the archived list when the address says so, the board otherwise
export function BoardFilter({ live, archived }: { live: BoardJob[]; archived: BoardJob[] }) {
  const showArchived = useSearchParams().get("archived") === "1";
  return <Board jobs={showArchived ? archived : live} archived={showArchived} />;
}
