import * as Constants from '../../../../../constants/teams'
import * as ProfileConstants from '../../../../../constants/profile'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Tracker2Gen from '../../../../../actions/tracker2-gen'
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
  const teamDetails = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const canManageBots = Container.useSelector(state => Constants.getCanPerformByID(state, teamID).manageBots)
  const {members: map = new Map<string, Types.MemberInfo>()} = teamDetails
  const info: Types.MemberInfo = map.get(ownProps.username) || blankInfo
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

  const dispatch = Container.useDispatch()
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const _onShowTracker = (username: string) => {
    if (Container.isMobile) {
      showUserProfile(username)
    } else {
      dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    }
  }
  const onClick = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: ownProps, selected: 'teamMember'}]}))
  }
  const onEdit = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              botUsername: ownProps.username,
              teamID: ownProps.teamID,
            },
            selected: 'chatInstallBot',
          },
        ],
      })
    )
  }
  const onRemove = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              botUsername: ownProps.username,
              teamID: ownProps.teamID,
            },
            selected: 'chatConfirmRemoveBot',
          },
        ],
      })
    )
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
