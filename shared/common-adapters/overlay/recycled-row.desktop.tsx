import * as React from 'react'
import {closePopupsAnchoredWithin} from '../popup/floating-box/anchored-popups.desktop'

// For a row a list recycles: when it starts showing another item, the popups anchored in it close,
// instead of staying open on the new item. Attach the ref to the row's element. Keyed on the item,
// not its index, so rows that only move (older messages loading above) keep their popups.
export const useRecycledRowRef = (rowKey: unknown) => {
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const keyRef = React.useRef(rowKey)
  React.useLayoutEffect(() => {
    if (keyRef.current === rowKey) {
      return
    }
    keyRef.current = rowKey
    if (rowRef.current) {
      closePopupsAnchoredWithin(rowRef.current)
    }
  }, [rowKey])
  return rowRef
}

// The same for a row with no element of its own; it adds one that takes no part in layout.
export const RecycledRow = (p: {rowKey: unknown; children: React.ReactNode}) => {
  const {children, rowKey} = p
  const ref = useRecycledRowRef(rowKey)
  return (
    <div ref={ref} style={contentsStyle}>
      {children}
    </div>
  )
}

const contentsStyle = {display: 'contents'} as const
