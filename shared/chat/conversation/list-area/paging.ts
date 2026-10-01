import type * as T from '@/constants/types'
import sortedIndexBy from 'lodash/sortedIndexBy'

// How near either end of the rows loaded the reader comes before the next page loads there, in
// screens (the list's viewport heights): desktop's list takes its thresholds in that unit, and the
// mobile list measures its scroll offset against it. Early enough that a page lands before a
// reader's fling reaches the edge of the rows it has.
export const pageLoadScreens = 2
export const withinPageLoad = (distance: number, viewport: number) => distance <= pageLoadScreens * viewport

// How far the inverted native list is from either end of the rows loaded (newest first). Its content
// ends at the oldest row laid out, which the list keeps within a screen of the view however many rows
// are loaded past it; those rows count toward the distance at the average height of the rows laid
// out, or the oldest end would always look a screen away.
export const nativePageDistances = (p: {
  content: number
  offset: number
  oldestLaidOut: T.Chat.Ordinal
  ordinals: ReadonlyArray<T.Chat.Ordinal>
  resting: number
  viewport: number
}) => {
  const {content, offset, oldestLaidOut, ordinals, resting, viewport} = p
  const notNewer = sortedIndexBy(ordinals as unknown as Array<number>, oldestLaidOut as unknown as number, o => -o)
  const laidOut = notNewer + (ordinals[notNewer] === oldestLaidOut ? 1 : 0)
  const notLaidOut = ordinals.length - laidOut
  return {
    newer: offset - resting,
    older: content - offset - viewport + (notLaidOut * content) / Math.max(laidOut, 1),
  }
}
