import * as React from 'react'
import {imgMaxWidthRaw} from '../messages/attachment/image/image-render'
import * as Styles from '../../../styles'
import * as ChatConstants from '../../../constants/chat2'
import * as ChatTypes from '../../../constants/types/chat2'
import * as TeamTypes from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'

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

const emptyMap = new Map()
const isBot = (type: TeamTypes.TeamRoleType) => type === 'bot' || type === 'restrictedbot'

export const useTeamHumans = (teamID: TeamTypes.TeamID) => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(TeamsGen.createGetMembers({teamID}))
  }, [dispatch, teamID])
  const teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(teamID)) || emptyMap
  const bots = React.useMemo(() => {
    const ret = new Set<string>()
    teamMembers.forEach(({type}, username) => isBot(type) && ret.add(username))
    return ret
  }, [teamMembers])
  const teamHumanCount = teamMembers.size - bots.size
  return {bots, teamHumanCount}
}

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
