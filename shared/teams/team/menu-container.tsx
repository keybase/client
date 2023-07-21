import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/teams'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import capitalize from 'lodash/capitalize'
import type * as Types from '../../constants/types/teams'
import {pluralize} from '../../util/string'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  teamID: Types.TeamID
  visible: boolean
}

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

export default (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const {teamname, role, memberCount} = Constants.useState(s => Constants.getTeamMeta(s, teamID))
  const yourOperations = Constants.useState(s => Constants.getCanPerformByID(s, teamID))
  const canDeleteTeam = yourOperations.deleteTeam
  const canInvite = yourOperations.manageMembers
  const canLeaveTeam = Constants.useState(s => !Constants.isLastOwner(s, teamID) && role !== 'none')
  const canViewFolder = !yourOperations.joinTeam
  const startAddMembersWizard = Constants.useState(s => s.dispatch.startAddMembersWizard)
  const onAddOrInvitePeople = () => {
    startAddMembersWizard(teamID)
  }
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onDeleteTeam = () => {
    navigateAppend({props: {teamID}, selected: 'teamDeleteTeam'})
  }
  const onLeaveTeam = () => {
    navigateAppend({props: {teamID}, selected: 'teamReallyLeaveTeam'})
  }
  const onOpenFolder = (teamname: string) => {
    FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))
  }

  const items: Kb.MenuItems = ['Divider']
  if (canInvite) {
    items.push({
      icon: 'iconfont-new',
      onClick: onAddOrInvitePeople,
      title: 'Add/Invite people',
    })
  }
  if (canViewFolder) {
    items.push({
      icon: 'iconfont-folder-open',
      onClick: () => onOpenFolder(teamname),
      title: 'Open team folder',
    })
  }
  if (items.length > 0 && (canLeaveTeam || canDeleteTeam)) {
    items.push('Divider')
  }
  items.push({
    danger: true,
    icon: 'iconfont-team-leave',
    onClick: onLeaveTeam,
    title: 'Leave team',
  })
  if (canDeleteTeam) {
    items.push({
      danger: true,
      icon: 'iconfont-trash',
      onClick: onDeleteTeam,
      title: 'Delete team',
    })
  }

  const props = {
    attachTo: ownProps.attachTo,
    items,
    memberCount: memberCount,
    onHidden: ownProps.onHidden,
    role: role as Types.TeamRoleType,
    teamname: teamname,
    visible: ownProps.visible,
  }
  return <TeamMenu {...props} />
}
