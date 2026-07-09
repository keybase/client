import * as React from 'react'
import type * as T from '@/constants/types'
import {useSyncLayout} from '@legendapp/list/react-native'
import {useOrdinal} from './ids-context'

// When a row's content settles to a new height after first paint (a flip result streams in,
// reactions appear, an unfurl loads), force LegendList to re-measure this row synchronously so its
// bottom-anchoring / re-pin uses the final height on the same frame instead of a frame late (which
// otherwise leaves the thread parked above the newest message). Pass a signature that changes when
// the height-affecting content changes. Flushes only when the signature changes for the SAME
// message: the initial mount and a recycled container switching to a new ordinal both get measured
// by LegendList's own onLayout, so flushing there is wasted sync layout work mid-scroll. Noops
// wherever the row is not inside a LegendList container, or on the old architecture.
export const useSyncRowLayout = (signature: string | number) => {
  const ordinal = useOrdinal()
  const syncLayout = useSyncLayout()
  const lastRef = React.useRef<{ordinal: T.Chat.Ordinal; signature: string | number} | undefined>(
    undefined
  )
  React.useLayoutEffect(() => {
    const last = lastRef.current
    lastRef.current = {ordinal, signature}
    if (last?.ordinal !== ordinal) return
    if (last.signature === signature) return
    syncLayout()
  }, [ordinal, signature, syncLayout])
}
