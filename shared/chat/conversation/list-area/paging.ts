// How near either end of the rows loaded the reader comes before the next page loads there, in
// screens (the list's viewport heights): desktop's list takes its thresholds in that unit, and the
// mobile list measures its scroll offset against it. Early enough that a page lands before a
// reader's fling reaches the edge of the rows it has.
export const pageLoadScreens = 2
export const withinPageLoad = (distance: number, viewport: number) => distance <= pageLoadScreens * viewport
