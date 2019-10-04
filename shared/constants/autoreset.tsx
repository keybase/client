import {formatDurationForAutoreset as formatDuration} from '../util/timestamp'

export const enterPipelineWaitingKey = 'autoreset:EnterPipelineWaitingKey'
export const actuallyResetWaitingKey = 'autoreset:ActuallyResetWaitingKey'
export const cancelResetWaitingKey = 'autoreset:cancelWaitingKey'

export const formatTimeLeft = (endTime: number) => {
  return formatDuration(endTime - Date.now())
}
