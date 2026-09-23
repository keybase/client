export type Fix = {accuracy: number; lat: number; lon: number}
// what shouldRecordFix knows of the fixes since the native watch started
export type FixThrottle = {lastRecorded?: Fix}

const backgroundFixDistance = 65
const maxBackgroundFixDistance = 200
export const earthRadiusMeters = 6371008.8

const distanceMeters = (a: Fix, b: Fix) => {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Out of the foreground a fix is recorded once it lies at least both fixes' accuracies added
// together from the last recorded one: closer than that the two could be the same spot, so jitter
// doesn't count as a move, even when the anchor was itself an outlier. That distance is kept
// between 65 and 200 m, so very coarse fixes (Approximate Location) still record a real move. A fix
// less than half as uncertain as the anchor also records, so a coarse cold fix gets replaced once
// the device locks on; accuracy 0 means unknown and never counts as better. The first fix after the
// watch starts always records, so the move that woke the app gets posted.
export const shouldRecordFix = (
  appState: 'active' | 'inactive' | 'background' | 'unknown',
  last: FixThrottle,
  next: Fix
): {record: boolean; throttle: FixThrottle} => {
  const anchor = last.lastRecorded
  let record = !anchor || appState === 'active'
  if (!record && anchor) {
    const minMove = Math.min(
      maxBackgroundFixDistance,
      Math.max(backgroundFixDistance, anchor.accuracy + next.accuracy)
    )
    record =
      distanceMeters(anchor, next) >= minMove || (next.accuracy > 0 && next.accuracy < anchor.accuracy / 2)
  }
  return {record, throttle: record ? {lastRecorded: next} : last}
}
