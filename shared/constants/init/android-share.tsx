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
}): AndroidShare | undefined => {
  const droppedCount = evt.droppedCount ?? 0
  if (evt.localPaths) {
    return {droppedCount, type: T.RPCGen.IncomingShareType.file, urls: evt.localPaths}
  }
  if (evt.text) {
    return {droppedCount, text: evt.text, type: T.RPCGen.IncomingShareType.text}
  }
  return undefined
}
