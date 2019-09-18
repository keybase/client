import {formatDurationForAutoreset as formatDuration} from '../util/timestamp'

export const waitingKeyCancelReset = 'autoreset:cancel'

export const formatTimeLeft = (endTime: number) => {
  return formatDuration(endTime - Date.now())
}
