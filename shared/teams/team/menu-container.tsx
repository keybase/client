import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Kb from '../../common-adapters'
import flags from '../../util/feature-flags'
import {appendNewTeamBuilder} from '../../actions/typed-routes'
import capitalize from 'lodash/capitalize'
import * as Styles from '../../styles'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  teamID: Types.TeamID
  visible: boolean
}

const mapStateToProps = (state: Container.TypedState, {teamID}: OwnProps) => {
  const teamDetails = Constants.getTeamDetails(state, teamID)
  const {teamname, role, memberCount} = Constants.getTeamMeta(state, teamID)
  const yourOperations = Constants.getCanPerformByID(state, teamID)
  const isBigTeam = Constants.isBigTeam(state, teamID)
  return {
    canCreateSubteam: yourOperations.manageSubteams,
    canDeleteTeam: yourOperations.deleteTeam && teamDetails.subteams?.size === 0,
    canInvite: yourOperations.manageMembers,
    canLeaveTeam: !Constants.isLastOwner(state, teamID) && role !== 'none',
    canManageChat: yourOperations.renameChannel,
    canViewFolder: !yourOperations.joinTeam,
    isBigTeam,
    memberCount,
    role,
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {teamID}: OwnProps) => ({
  onAddOrInvitePeople: () => dispatch(appendNewTeamBuilder(teamID)),
  onCopyInviteLink: () => {}, // TODO
  onCreateSubteam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {subteamOf: teamID}, selected: 'teamNewTeamDialog'}],
      })
    ),
  onDeleteTeam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID}, selected: 'teamDeleteTeam'}],
      })
    ),
  onLeaveTeam: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID}, selected: 'teamReallyLeaveTeam'}],
      })
    ),
  onManageChat: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: flags.teamsRedesign
          ? [{props: {mode: 'self', teamID}, selected: 'teamAddToChannels'}]
          : [{props: {teamID}, selected: 'chatManageChannels'}],
      })
    ),
  onOpenFolder: (teamname: string) =>
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))),
})

type Props = {
  attachTo?: () => React.Component<any> | null
  items: Kb.MenuItems
  teamname: string
  memberCount: number
  role: Types.TeamRoleType
  onHidden: () => void
  visible: boolean
}

const TeamMenu = (props: Props) => {
  const {attachTo, items, onHidden, visible, teamname, memberCount, role} = props
  if (visible && items.length === 0) {
    onHidden()
    return null
  }
  const header = (
    <Kb.ConnectedNameWithIcon
      teamname={teamname}
      title={teamname}
      metaOne={<Kb.Text type="BodySmall">{memberCount} members</Kb.Text>}
      metaTwo={
        <Kb.Box2 direction="horizontal" alignItems="flex-start" gap="xtiny">
          {(role === 'admin' || role === 'owner') && (
            <Kb.Icon
              color={role === 'owner' ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
              fontSize={10}
              type="iconfont-crown-owner"
            />
          )}
          <Kb.Text type="BodySmall">{capitalize(role)}</Kb.Text>
        </Kb.Box2>
      }
      containerStyle={{padding: 4}}
    />
  )
  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      header={flags.teamsRedesign ? header : undefined}
      items={items}
      onHidden={onHidden}
      visible={visible}
    />
  )
}

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const items: Kb.MenuItems = []
    if (flags.teamsRedesign) {
      if (stateProps.canInvite) {
        items.push({
          onClick: dispatchProps.onAddOrInvitePeople,
          title: 'Add/Invite people',
        })
        if (flags.teamInvites) {
          items.push({
            onClick: dispatchProps.onCopyInviteLink,
            title: 'Copy invite link',
          })
        }
      }
      if (stateProps.canViewFolder) {
        items.push({
          icon: 'iconfont-folder-open',
          onClick: () => dispatchProps.onOpenFolder(stateProps.teamname),
          title: 'Open folder',
        })
      }
      if (items.length > 0 && (stateProps.canLeaveTeam || stateProps.canDeleteTeam)) {
        items.push('Divider')
      }
    } else {
      if (stateProps.canManageChat) {
        items.push({
          icon: 'iconfont-hash',
          onClick: dispatchProps.onManageChat,
          subTitle: stateProps.isBigTeam ? undefined : 'Turns this into a big team',
          title: stateProps.isBigTeam ? 'Manage chat channels' : 'Make chat channels...',
        })
      }
      if (stateProps.canCreateSubteam) {
        items.push({icon: 'iconfont-people', onClick: dispatchProps.onCreateSubteam, title: 'Create subteam'})
      }
      if (stateProps.canViewFolder) {
        items.push({
          icon: 'iconfont-folder-open',
          onClick: () => dispatchProps.onOpenFolder(stateProps.teamname),
          title: 'Open folder',
        })
      }
    }
    if (stateProps.canLeaveTeam || !flags.teamsRedesign) {
      items.push({
        danger: true,
        icon: 'iconfont-leave',
        onClick: dispatchProps.onLeaveTeam,
        title: 'Leave team',
      })
    }
    if (stateProps.canDeleteTeam) {
      items.push({
        danger: true,
        icon: 'iconfont-remove',
        onClick: dispatchProps.onDeleteTeam,
        title: 'Delete team',
      })
    }

    return {
      attachTo: ownProps.attachTo,
      items,
      memberCount: stateProps.memberCount,
      onHidden: ownProps.onHidden,
      role: stateProps.role,
      teamname: stateProps.teamname,
      visible: ownProps.visible,
    }
  }
)(TeamMenu) as any
