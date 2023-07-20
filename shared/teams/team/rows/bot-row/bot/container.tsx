import * as RouterConstants from '../../../../../constants/router2'
import * as Constants from '../../../../../constants/teams'
import * as TrackerConstants from '../../../../../constants/tracker2'
import * as ProfileConstants from '../../../../../constants/profile'
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
  const teamDetails = Constants.useState(s => s.teamDetails.get(teamID))
  const canManageBots = Constants.useState(s => Constants.getCanPerformByID(s, teamID).manageBots)
  const map = teamDetails?.members
  const info: Types.MemberInfo = map?.get(ownProps.username) || blankInfo
  const bot: RPCTypes.FeaturedBot = Container.useSelector(
    state =>
      state.chat2.featuredBotsMap.get(ownProps.username) ?? {
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
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const _onShowTracker = (username: string) => {
    if (Container.isMobile) {
      showUserProfile(username)
    } else {
      showUser(username, true)
    }
  }
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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
