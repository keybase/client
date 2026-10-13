import type * as React from 'react'

// Popups on recycled list rows are a desktop concern.
export const useRecycledRowRef = (_rowKey: unknown) => undefined
export const RecycledRow = (p: {rowKey: unknown; children: React.ReactNode}) => p.children as React.ReactElement
