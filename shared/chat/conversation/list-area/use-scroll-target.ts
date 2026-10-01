import * as React from 'react'
import {makeScrollTarget, ownsEnd} from './scroll-target'

// The target's identity never changes, so the list's own loops can report back to it while the
// directives they carry out come from it too.
export const useScrollTarget = () => {
  const [target] = React.useState(makeScrollTarget)
  const listOwnsEnd = React.useSyncExternalStore(target.subscribe, () => ownsEnd(target.state))
  return {listOwnsEnd, scrollTarget: target}
}

// Whether the rows now shown hold the newest message as a thread that already held it: false for the
// page of newer rows that brings it into a window of history, which is laid out as the page it is,
// and true again from the next rows on. Rows refilling a cleared thread, or a new dataset, are no
// window of history, so they are held at once. Decided from the rows themselves, once per change to
// them, so it holds however React schedules the render.
export const useHeldLatest = (containsLatest: boolean, datasetKey: string, rows: ReadonlyArray<unknown>) => {
  const [seen, setSeen] = React.useState({containsLatest, datasetKey, heldLatest: containsLatest, rows})
  if (seen.rows === rows && seen.datasetKey === datasetKey && seen.containsLatest === containsLatest) {
    return seen.heldLatest
  }
  const bringsLatest =
    containsLatest && !seen.containsLatest && seen.datasetKey === datasetKey && seen.rows.length > 0
  const next = {containsLatest, datasetKey, heldLatest: containsLatest && !bringsLatest, rows}
  setSeen(next)
  return next.heldLatest
}
