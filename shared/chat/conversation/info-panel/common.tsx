import {imgMaxWidthRaw} from '../messages/attachment/image/image-render'
import * as Styles from '../../../styles'
import * as ChatConstants from '../../../constants/chat2'
import * as ChatTypes from '../../../constants/types/chat2'
import {useTeamHumans} from '../../../teams/common'
import * as Container from '../../../util/container'

export const infoPanelWidthElectron = 320
export const infoPanelWidthPhone = imgMaxWidthRaw()
export const infoPanelWidthTablet = 350

export function infoPanelWidth() {
  if (Styles.isTablet) {
    return infoPanelWidthTablet
  } else if (Styles.isMobile) {
    return infoPanelWidthPhone
  } else {
    return infoPanelWidthElectron
  }
}

export {useTeamHumans}

export const useHumans = (conversationIDKey: ChatTypes.ConversationIDKey) => {
  const conversationMeta = Container.useSelector(state => ChatConstants.getMeta(state, conversationIDKey))
  const participantInfo = Container.useSelector(state =>
    ChatConstants.getParticipantInfo(state, conversationIDKey)
  )
  const {bots, teamHumanCount} = useTeamHumans(conversationMeta.teamID)
  const channelHumans =
    conversationMeta.teamType === 'adhoc'
      ? participantInfo.name
      : participantInfo.all.filter(username => !bots.has(username))
  return {channelHumans, teamHumanCount}
}

