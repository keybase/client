import * as React from 'react'
import {useSyncLayout} from '@legendapp/list/react-native'

// When a row's content settles to a new height after first paint (a flip result streams in,
// reactions appear, an unfurl loads), force LegendList to re-measure this row synchronously so its
// bottom-anchoring / re-pin uses the final height on the same frame instead of a frame late (which
// otherwise leaves the thread parked above the newest message). Pass a signature that changes when
// the height-affecting content changes; the initial mount is skipped since LegendList measures that
// via its own onLayout. Noops on desktop / old architecture (useSyncLayout returns noop there).
export const useSyncRowLayout = (signature: string | number) => {
  const syncLayout = useSyncLayout()
  const firstRef = React.useRef(true)
  React.useLayoutEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    syncLayout()
  }, [signature, syncLayout])
}
