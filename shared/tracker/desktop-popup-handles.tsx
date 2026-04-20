import * as RemoteGen from '@/constants/remote-actions'
import {registerExternalResetter} from '@/util/zustand'

type TrackerPopupHandlers = {
  changeFollow: (guiID: string, follow: boolean) => void
  closeTracker: (guiID: string) => void
  ignore: (guiID: string) => void
  load: (payload: RemoteGen.TrackerLoadPayload['payload']) => void
}

let handlers: TrackerPopupHandlers | undefined

export const registerTrackerPopupHandlers = (nextHandlers: TrackerPopupHandlers) => {
  handlers = nextHandlers
  return () => {
    if (handlers === nextHandlers) {
      handlers = undefined
    }
  }
}

export const clearTrackerPopupHandlers = () => {
  handlers = undefined
}

export const handleTrackerPopupRemoteAction = (
  action:
    | RemoteGen.TrackerChangeFollowPayload
    | RemoteGen.TrackerCloseTrackerPayload
    | RemoteGen.TrackerIgnorePayload
    | RemoteGen.TrackerLoadPayload
) => {
  if (!handlers) {
    return false
  }
  switch (action.type) {
    case RemoteGen.trackerChangeFollow:
      handlers.changeFollow(action.payload.guiID, action.payload.follow)
      return true
    case RemoteGen.trackerIgnore:
      handlers.ignore(action.payload.guiID)
      return true
    case RemoteGen.trackerCloseTracker:
      handlers.closeTracker(action.payload.guiID)
      return true
    case RemoteGen.trackerLoad:
      handlers.load(action.payload)
      return true
  }
}

registerExternalResetter('tracker-popup-handles', clearTrackerPopupHandlers)
