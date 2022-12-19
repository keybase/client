import * as React from 'react'
import * as Constants from '../../constants/teams'
import type * as Types from '../../constants/types/teams'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as Kb from '../../common-adapters'
import capitalize from 'lodash/capitalize'
import * as Styles from '../../styles'
import {pluralize} from '../../util/string'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  teamID: Types.TeamID
  visible: boolean
}

const mapStateToProps = (state: Container.TypedState, {teamID}: OwnProps) => {
  const {teamname, role, memberCount} = Constants.getTeamMeta(state, teamID)
  const yourOperations = Constants.getCanPerformByID(state, teamID)
  const isBigTeam = Constants.isBigTeam(state, teamID)
  return {
    canCreateSubteam: yourOperations.manageSubteams,
    canDeleteTeam: yourOperations.deleteTeam,
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
  onAddOrInvitePeople: () => dispatch(TeamsGen.createStartAddMembersWizard({teamID})),
  onCopyInviteLink: () => {}, // TODO
  onCreateSubteam: () => dispatch(TeamsGen.createLaunchNewTeamWizardOrModal({subteamOf: teamID})),
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
  onManageChat: () => dispatch(TeamsGen.createManageChatChannels({teamID})),
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
      metaOne={
        <Kb.Text type="BodySmall">
          {memberCount} {pluralize('member', memberCount)}
        </Kb.Text>
      }
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
      containerStyle={styles.headerContainer}
    />
  )
  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={onHidden}
      visible={visible}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  headerContainer: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xtiny),
    },
    isElectron: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: 20,
    },
  }),
}))

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const items: Kb.MenuItems = ['Divider']
    if (stateProps.canInvite) {
      items.push({
        icon: 'iconfont-new',
        onClick: dispatchProps.onAddOrInvitePeople,
        title: 'Add/Invite people',
      })
    }
    if (stateProps.canViewFolder) {
      items.push({
        icon: 'iconfont-folder-open',
        onClick: () => dispatchProps.onOpenFolder(stateProps.teamname),
        title: 'Open team folder',
      })
    }
    if (items.length > 0 && (stateProps.canLeaveTeam || stateProps.canDeleteTeam)) {
      items.push('Divider')
    }
    items.push({
      danger: true,
      icon: 'iconfont-team-leave',
      onClick: dispatchProps.onLeaveTeam,
      title: 'Leave team',
    })
    if (stateProps.canDeleteTeam) {
      items.push({
        danger: true,
        icon: 'iconfont-trash',
        onClick: dispatchProps.onDeleteTeam,
        title: 'Delete team',
      })
    }

    return {
      attachTo: ownProps.attachTo,
      items,
      memberCount: stateProps.memberCount,
      onHidden: ownProps.onHidden,
      role: stateProps.role as Types.TeamRoleType,
      teamname: stateProps.teamname,
      visible: ownProps.visible,
    }
  }
)(TeamMenu) as any
