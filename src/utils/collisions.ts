export type CollisionType = 'block-block' | 'block-event' | 'event-event';

export interface Collision {
  idA: string;
  idB: string;
  type: CollisionType;
  titleA: string;
  titleB: string;
  startA: string; // HH:MM
  endA: string;
  startB: string;
  endB: string;
}

interface BlockLike {
  id: string;
  title: string;
  startTime: string; // HH:MM
  endTime: string;
}

interface CalEventLike {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isAllDay?: boolean;
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function overlaps(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

export function detectCollisions(
  blocks: BlockLike[],
  calEvents: CalEventLike[],
): Collision[] {
  const timedEvts = calEvents.filter((e) => !e.isAllDay);
  const result: Collision[] = [];

  // Block vs block
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i], b = blocks[j];
      if (overlaps(toMins(a.startTime), toMins(a.endTime), toMins(b.startTime), toMins(b.endTime))) {
        result.push({
          idA: a.id, idB: b.id, type: 'block-block',
          titleA: a.title, titleB: b.title,
          startA: a.startTime, endA: a.endTime,
          startB: b.startTime, endB: b.endTime,
        });
      }
    }
  }

  // Block vs event
  for (const block of blocks) {
    for (const evt of timedEvts) {
      const es = dateToHHMM(evt.startDate), ee = dateToHHMM(evt.endDate);
      if (overlaps(toMins(block.startTime), toMins(block.endTime), toMins(es), toMins(ee))) {
        result.push({
          idA: block.id, idB: evt.id, type: 'block-event',
          titleA: block.title, titleB: evt.title,
          startA: block.startTime, endA: block.endTime,
          startB: es, endB: ee,
        });
      }
    }
  }

  // Event vs event
  for (let i = 0; i < timedEvts.length; i++) {
    for (let j = i + 1; j < timedEvts.length; j++) {
      const a = timedEvts[i], b = timedEvts[j];
      const as_ = dateToHHMM(a.startDate), ae = dateToHHMM(a.endDate);
      const bs = dateToHHMM(b.startDate), be = dateToHHMM(b.endDate);
      if (overlaps(toMins(as_), toMins(ae), toMins(bs), toMins(be))) {
        result.push({
          idA: a.id, idB: b.id, type: 'event-event',
          titleA: a.title, titleB: b.title,
          startA: as_, endA: ae, startB: bs, endB: be,
        });
      }
    }
  }

  return result;
}

/** Compute column layout so overlapping items render side by side. */
export interface LayoutInfo {
  col: number;
  numCols: number;
}

interface LayoutEntry {
  id: string;
  startMins: number;
  endMins: number;
}

export function computeLayout(
  blocks: { id: string; startTime: string; endTime: string }[],
  calEvents: CalEventLike[],
): Map<string, LayoutInfo> {
  const entries: LayoutEntry[] = [
    ...blocks.map((b) => ({
      id: b.id,
      startMins: toMins(b.startTime),
      endMins: toMins(b.endTime),
    })),
    ...calEvents
      .filter((e) => !e.isAllDay)
      .map((e) => ({
        id: e.id,
        startMins: e.startDate.getHours() * 60 + e.startDate.getMinutes(),
        endMins: e.endDate.getHours() * 60 + e.endDate.getMinutes(),
      })),
  ];

  const sorted = [...entries].sort((a, b) => a.startMins - b.startMins || a.endMins - b.endMins);
  const colAssign = new Map<string, number>();

  for (const item of sorted) {
    const usedCols = new Set<number>();
    for (const [otherId, otherCol] of colAssign) {
      const other = entries.find((e) => e.id === otherId)!;
      if (other.endMins > item.startMins && item.endMins > other.startMins) {
        usedCols.add(otherCol);
      }
    }
    let col = 0;
    while (usedCols.has(col)) col++;
    colAssign.set(item.id, col);
  }

  const result = new Map<string, LayoutInfo>();
  for (const item of entries) {
    const myCol = colAssign.get(item.id) ?? 0;
    let maxCol = myCol;
    for (const [otherId, otherCol] of colAssign) {
      if (otherId !== item.id) {
        const other = entries.find((e) => e.id === otherId)!;
        if (other.startMins < item.endMins && item.startMins < other.endMins) {
          maxCol = Math.max(maxCol, otherCol);
        }
      }
    }
    result.set(item.id, { col: myCol, numCols: maxCol + 1 });
  }

  return result;
}
