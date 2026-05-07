import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'

export const resetBannerTypeFromTlf = (tlf: T.FS.Tlf): T.FS.ResetBannerType => {
  const {resetParticipants} = tlf
  if (resetParticipants.length === 0) {
    return T.FS.ResetBannerNoOthersType.None
  }

  const you = useCurrentUserState.getState().username
  if (resetParticipants.findIndex(username => username === you) >= 0) {
    return T.FS.ResetBannerNoOthersType.Self
  }
  return resetParticipants.length
}
