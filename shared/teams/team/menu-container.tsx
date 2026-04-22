import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import * as FS from '@/constants/fs'
import * as Teams from '@/stores/teams'
import capitalize from 'lodash/capitalize'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import {useLoadedTeam} from './use-loaded-team'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  onHidden: () => void
  teamID: T.Teams.TeamID
  visible: boolean
}

type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  items: Kb.MenuItems
  teamname: string
  memberCount: number
  role: T.Teams.TeamRoleType
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
              color={role === 'owner' ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny),
    },
    isElectron: {
      paddingBottom: Kb.Styles.globalMargins.tiny,
      paddingTop: 20,
    },
  }),
}))

const Container = (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const {teamDetails, teamMeta, yourOperations} = useLoadedTeam(teamID)
  const {teamname, role, memberCount} = teamMeta
  const canDeleteTeam = yourOperations.deleteTeam
  const canInvite = yourOperations.manageMembers
  const ownerCount = [...teamDetails.members.values()].filter(member => member.type === 'owner').length
  const canLeaveTeam = role !== 'none' && !(role === 'owner' && ownerCount <= 1)
  const canViewFolder = !yourOperations.joinTeam
  const startAddMembersWizard = Teams.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const onAddOrInvitePeople = () => {
    startAddMembersWizard(teamID)
  }
  const navigateAppend = C.Router2.navigateAppend
  const onDeleteTeam = () => {
    navigateAppend({name: 'teamDeleteTeam', params: {teamID}})
  }
  const onLeaveTeam = () => {
    navigateAppend({name: 'teamReallyLeaveTeam', params: {teamID}})
  }
  const onOpenFolder = (teamname: string) => {
    FS.navToPath(T.FS.stringToPath(`/keybase/team/${teamname}`))
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
    memberCount,
    onHidden: ownProps.onHidden,
    role: role as T.Teams.TeamRoleType,
    teamname,
    visible: ownProps.visible,
  }
  return <TeamMenu {...props} />
}

export default Container
