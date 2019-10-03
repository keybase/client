import {formatDurationForAutoreset as formatDuration} from '../util/timestamp'

export const waitingKeyEnterPipeline = 'autoreset:EnterPipelineWaitingKey'
export const waitingKeyActuallyReset = 'autoreset:ActuallyResetWaitingKey'
export const waitingKeyCancelReset = 'autoreset:cancelWaitingKey'

export const formatTimeLeft = (endTime: number) => {
  return formatDuration(endTime - Date.now())
}
