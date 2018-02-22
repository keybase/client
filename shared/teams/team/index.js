// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import {Box, Icon, PopupMenu} from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'
import * as RPCTypes from '../../constants/types/rpc-gen'
import List, {type TeamRows} from './list'

export type Props = {
  description: string,
  newTeamRequests: Array<Types.Teamname>,
  loading: boolean,
  memberCount: number,
  name: Types.Teamname,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  onAddPeople: () => void,
  onAddSelf: () => void,
  onCreateSubteam: () => void,
  onInviteByEmail: () => void,
  setSelectedTab: (t: ?Types.TabKey) => void,
  onEditDescription: () => void,
  onLeaveTeam: () => void,
  onManageChat: () => void,
  openTeam: boolean,
  selectedTab: Types.TabKey,
  showAddYourselfBanner: boolean,
  showMenu: boolean,
  setShowMenu: (s: boolean) => void,
  you: string,
  yourRole: ?Types.TeamRoleType,
  yourOperations: RPCTypes.TeamOperation,
}

const Team = (props: Props) => {
  const {name} = props

  const teamname = name

  const rows: TeamRows = [{type: 'header', teamname}]
  rows.push({
    type: 'tabs',
    admin: props.yourOperations.manageMembers,
    memberCount: props.memberCount,
    teamname,
    newTeamRequests: props.newTeamRequests,
    numInvites: props.numInvites,
    numRequests: props.numRequests,
    numSubteams: props.numSubteams,
    loading: props.loading,
    selectedTab: props.selectedTab,
    setSelectedTab: props.setSelectedTab,
    yourOperations: props.yourOperations,
  })

  if (props.selectedTab === 'members') {
    rows.push({type: 'members', teamname})
  } else if (props.selectedTab === 'subteams') {
    rows.push({type: 'subteams', teamname})
  } else if (props.selectedTab === 'invites') {
    rows.push({type: 'invites', teamname})
  } else if (props.selectedTab === 'publicity') {
    rows.push({type: 'settings', teamname})
  }

  const popupMenuItems = []
  if (props.yourOperations.renameChannel) {
    popupMenuItems.push({onClick: props.onManageChat, title: 'Manage chat channels'})
  }
  if (props.yourOperations.leaveTeam) {
    popupMenuItems.push({onClick: props.onLeaveTeam, title: 'Leave team', danger: true})
  }
  if (props.yourOperations.manageSubteams) {
    popupMenuItems.push({onClick: props.onCreateSubteam, title: 'Create subteam'})
  }

  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <List rows={rows} />

      {props.showMenu &&
        popupMenuItems.length > 0 && (
          <PopupMenu
            items={popupMenuItems}
            onHidden={() => props.setShowMenu(false)}
            style={{position: 'absolute', right: globalMargins.tiny, top: globalMargins.large}}
          />
        )}
    </Box>
  )
}
export default Team

type CustomProps = {
  onOpenFolder: () => void,
  onManageChat: () => void,
  onShowMenu: () => void,
  canManageChat: boolean,
  canViewFolder: boolean,
}

const CustomComponent = ({
  onOpenFolder,
  onManageChat,
  onShowMenu,
  canManageChat,
  canViewFolder,
}: CustomProps) => (
  <Box style={{...globalStyles.flexBoxRow, position: 'absolute', right: 0}}>
    {!isMobile &&
      canManageChat && (
        <Icon
          onClick={onManageChat}
          style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
          type="iconfont-chat"
        />
      )}
    {!isMobile &&
      canViewFolder && (
        <Icon
          onClick={onOpenFolder}
          style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
          type="iconfont-folder-private"
        />
      )}
    <Icon
      onClick={onShowMenu}
      type="iconfont-ellipsis"
      style={{
        fontSize: isMobile ? 20 : 16,
        marginRight: isMobile ? globalMargins.xtiny : globalMargins.tiny,
        padding: isMobile ? globalMargins.xtiny : 0,
      }}
    />
  </Box>
)
export {CustomComponent}
