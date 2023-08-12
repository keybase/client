import * as C from '../../../../../constants'
import * as Constants from '../../../../../constants/teams'
import * as TrackerConstants from '../../../../../constants/tracker2'
import * as Container from '../../../../../util/container'
import type * as RPCTypes from '../../../../../constants/types/rpc-gen'
import type * as Types from '../../../../../constants/types/teams'
import {TeamBotRow} from './'

type OwnProps = {
  teamID: Types.TeamID
  username: string
}

const blankInfo = Constants.initialMemberInfo

export default (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const canManageBots = C.useTeamsState(s => Constants.getCanPerformByID(s, teamID).manageBots)
  const map = teamDetails?.members
  const info: Types.MemberInfo = map?.get(ownProps.username) || blankInfo
  const bot: RPCTypes.FeaturedBot = C.useBotsState(
    s =>
      s.featuredBotsMap.get(ownProps.username) ?? {
        botAlias: info.fullName,
        botUsername: ownProps.username,
        description: '',
        extendedDescription: '',
        extendedDescriptionRaw: '',
        isPromoted: false,
        rank: 0,
      }
  )

  const {botAlias, description} = bot

  const ownerTeam = bot.ownerTeam || undefined
  const ownerUser = bot.ownerUser || undefined
  const roleType = info.type
  const status = info.status
  const username = info.username
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const _onShowTracker = (username: string) => {
    if (Container.isMobile) {
      showUserProfile(username)
    } else {
      showUser(username, true)
    }
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClick = () => {
    navigateAppend({props: ownProps, selected: 'teamMember'})
  }
  const onEdit = () => {
    navigateAppend({
      props: {botUsername: ownProps.username, teamID: ownProps.teamID},
      selected: 'chatInstallBot',
    })
  }
  const onRemove = () => {
    navigateAppend({
      props: {botUsername: ownProps.username, teamID: ownProps.teamID},
      selected: 'chatConfirmRemoveBot',
    })
  }
  const props = {
    botAlias: botAlias,
    canManageBots: canManageBots,
    description: description,
    onClick: onClick,
    onEdit: onEdit,
    onRemove: onRemove,
    onShowTracker: () => _onShowTracker(ownProps.username),
    ownerTeam: ownerTeam,
    ownerUser: ownerUser,
    roleType: roleType,
    status: status,
    username: username,
  }
  return <TeamBotRow {...props} />
}
