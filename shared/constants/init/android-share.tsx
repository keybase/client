import * as T from '@/constants/types'
import type {useConfigState} from '@/stores/config'

type AndroidShare = NonNullable<ReturnType<typeof useConfigState.getState>['androidShare']>

// What the native share event becomes. Files win over text; a share whose
// files all failed (no paths, droppedCount > 0) still routes, so the user is
// told rather than left with nothing.
export const androidShareFromEvent = (evt: {
  text?: string
  localPaths?: Array<string>
  droppedCount?: number
  id: number
}): AndroidShare | undefined => {
  const {id} = evt
  const droppedCount = evt.droppedCount ?? 0
  if (evt.localPaths) {
    return {droppedCount, id, type: T.RPCGen.IncomingShareType.file, urls: evt.localPaths}
  }
  if (evt.text) {
    return {droppedCount, id, text: evt.text, type: T.RPCGen.IncomingShareType.text}
  }
  return undefined
}

// The link that opens an Android share. It names the share, so the screen it opens knows which
// share is its own: see incoming-share's useIncomingShareItems.
export const androidShareURL = (id: number) => `keybase://incoming-share?androidShare=${id}`
