// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {
  Avatar,
  Badge,
  Box,
  Button,
  ButtonBar,
  ClickableBox,
  Text,
  Tabs,
  List,
  Icon,
  PopupMenu,
  ProgressIndicator,
} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'
import Members from './members/container'
import Settings from './settings/container'
import RequestsAndInvites from './invites/container'
import TeamSubteamRow from './subteam-row/container'
import SubteamBanner from './subteam-banner'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as I from 'immutable'

export type Props = {
  description: string,
  newTeamRequests: Array<Types.Teamname>,
  loading: boolean,
  memberCount: number,
  name: Types.Teamname,
  numInvites: number,
  numRequests: number,
  onAddPeople: () => void,
  onAddSelf: () => void,
  onInviteByEmail: () => void,
  setSelectedTab: (t: ?Types.TabKey) => void,
  onCreateSubteam: () => void,
  onEditDescription: () => void,
  onHideSubteamsBanner: () => void,
  onLeaveTeam: () => void,
  onManageChat: () => void,
  onReadMoreAboutSubteams: () => void,
  sawSubteamsBanner: boolean,
  selectedTab: Types.TabKey,
  showAddYourselfBanner: boolean,
  showMenu: boolean,
  setShowMenu: (s: boolean) => void,
  subteams: I.List<Types.Teamname>,
  you: string,
  yourRole: ?Types.TeamRoleType,
  yourOperations: RPCTypes.TeamOperation,
}

const Help = isMobile
  ? () => null
  : ({name}: {name: Types.Teamname}) => (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', margin: 20}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginBottom: globalMargins.xtiny}}>
          <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
          <Icon
            style={{
              color: globalColors.black_10,
              paddingLeft: globalMargins.tiny,
              paddingRight: globalMargins.tiny,
            }}
            type="iconfont-info"
          />
          <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
        </Box>
        <Text type="BodySmall" style={{textAlign: 'center'}}>
          You can also manage teams from the terminal:
        </Text>
        <Text
          type="TerminalInline"
          style={{
            ...globalStyles.selectable,
            marginLeft: globalMargins.xtiny,
            marginTop: globalMargins.xtiny,
          }}
        >
          keybase team --help
        </Text>
      </Box>
    )

type TeamTabsProps = {
  admin: boolean,
  memberCount: number,
  name: Types.Teamname,
  newTeamRequests: Array<Types.Teamname>,
  numInvites: number,
  numRequests: number,
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Types.TabKey) => void,
  subteams: I.List<Types.Teamname>,
  yourOperations: RPCTypes.TeamOperation,
}

const SubteamsIntro = ({row}) => (
  <SubteamBanner
    key={row.key}
    onHideSubteamsBanner={row.onHideSubteamsBanner}
    onReadMore={row.onReadMore}
    teamname={row.teamname}
  />
)

const SubteamRow = ({row}) => (
  <Box key={row.teamname + 'row'}>
    <TeamSubteamRow teamname={row.teamname} />
  </Box>
)

const AddSubTeam = ({row}) => (
  <Box
    key="addSubteam"
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: globalMargins.medium,
      padding: globalMargins.medium,
      width: '100%',
    }}
  >
    <ClickableBox
      onClick={row.onCreateSubteam}
      style={{...globalStyles.flexBoxRow, flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}
    >
      <Icon type="iconfont-new" style={{color: globalColors.blue}} />
      <Text type="BodyBigLink" style={{padding: globalMargins.xtiny}}>
        Create subteam
      </Text>
    </ClickableBox>
  </Box>
)

const NoSubteams = ({row}) => (
  <Box
    key="noSubteams"
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: globalMargins.medium,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text type="BodySmall">This team has no subteams.</Text>
    </Box>
  </Box>
)

const subTeamsRow = (index, row) => {
  switch (row.type) {
    case 'intro':
      return <SubteamsIntro row={row} />
    case 'addSubteam':
      return <AddSubTeam row={row} />
    case 'noSubteams':
      return <NoSubteams row={row} />
    default:
      return <SubteamRow row={row} />
  }
}

const TeamTabs = (props: TeamTabsProps) => {
  const {
    admin,
    numInvites,
    memberCount,
    name,
    newTeamRequests,
    numRequests,
    subteams,
    loading = false,
    selectedTab,
    setSelectedTab,
    yourOperations,
  } = props
  let membersLabel = 'MEMBERS'
  membersLabel += !loading && memberCount !== 0 ? ` (${memberCount})` : ''
  const tabs = [
    <Text
      key="members"
      type="BodySmallSemibold"
      style={{
        color: globalColors.black_75,
      }}
    >
      {membersLabel}
    </Text>,
  ]

  let requestsBadge = 0
  if (newTeamRequests.length) {
    // Use min here so we never show a badge number > the (X) number of requests we have
    requestsBadge = Math.min(
      newTeamRequests.reduce((count, team) => (team === name ? count + 1 : count), 0),
      numRequests
    )
  }

  if (admin) {
    let invitesLabel = 'INVITES'
    invitesLabel += !loading && numInvites + numRequests !== 0 ? ` (${numInvites + numRequests})` : ''
    tabs.push(
      <Box key="invites" style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Text
          type="BodySmallSemibold"
          style={{
            color: globalColors.black_75,
          }}
        >
          {invitesLabel}
        </Text>
        {!!requestsBadge && <Badge badgeNumber={requestsBadge} badgeStyle={{marginTop: 1, marginLeft: 2}} />}
      </Box>
    )
  }

  let subteamsLabel = 'SUBTEAMS'
  subteamsLabel += !loading && subteams.count() !== 0 ? ` (${subteams.count()})` : ''
  if (subteams.count() > 0 || yourOperations.manageSubteams) {
    tabs.push(
      <Text
        key="subteams"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        {subteamsLabel}
      </Text>
    )
  }

  const publicityLabel = 'SETTINGS'
  tabs.push(
    isMobile ? (
      <Icon key="publicity" type="iconfont-nav-settings" />
    ) : (
      <Text
        key="publicity"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        {publicityLabel}
      </Text>
    )
  )

  if (loading) {
    tabs.push(<ProgressIndicator style={{alignSelf: 'center', width: 17, height: 17}} />)
  }

  const onSelect = (tab: any) => {
    const key = tab && tab.key
    if (key) {
      if (key !== 'loadingIndicator') {
        setSelectedTab(key)
      } else {
        setSelectedTab('members')
      }
    }
  }

  const selected = tabs.find(tab => tab.key === selectedTab)
  return (
    <Tabs
      tabs={tabs}
      selected={selected}
      onSelect={onSelect}
      style={{flexBasis: '100%'}}
      tabStyle={
        isMobile
          ? {
              paddingLeft: globalMargins.tiny,
              paddingRight: globalMargins.tiny,
            }
          : {}
      }
    />
  )
}

class Team extends React.PureComponent<Props> {
  render() {
    const {
      description,
      name,
      showMenu,
      setShowMenu,
      onAddPeople,
      onAddSelf,
      onCreateSubteam,
      onEditDescription,
      onInviteByEmail,
      onLeaveTeam,
      selectedTab,
      loading,
      memberCount,
      onHideSubteamsBanner,
      onManageChat,
      onReadMoreAboutSubteams,
      sawSubteamsBanner,
      subteams,
      yourRole,
      yourOperations,
    } = this.props

    const teamname = name

    let contents
    if (selectedTab === 'members') {
      contents = <Members teamname={teamname} />
    } else if (selectedTab === 'subteams') {
      const noSubteams = subteams.isEmpty()
      const subTeamsItems = [
        ...(!sawSubteamsBanner
          ? [
              {
                key: 'intro',
                teamname,
                type: 'intro',
                onHideSubteamsBanner,
                onReadMore: onReadMoreAboutSubteams,
              },
            ]
          : []),
        ...(yourOperations.manageSubteams ? [{key: 'addSubteam', type: 'addSubteam', onCreateSubteam}] : []),
        ...subteams.map(subteam => ({key: subteam, teamname: subteam, type: 'subteam'})),
        ...(noSubteams ? [{key: 'noSubteams', type: 'noSubteams'}] : []),
      ]

      contents = !loading && (
        <List
          items={subTeamsItems}
          fixedHeight={48}
          keyProperty="key"
          renderItem={subTeamsRow}
          style={{alignSelf: 'stretch'}}
        />
      )
    } else if (selectedTab === 'invites') {
      contents = <RequestsAndInvites teamname={teamname} />
    } else if (selectedTab === 'publicity') {
      contents = <Settings teamname={teamname} />
    }

    const popupMenuItems = []

    if (yourOperations.renameChannel) {
      popupMenuItems.push({onClick: onManageChat, title: 'Manage chat channels'})
    }

    if (yourOperations.leaveTeam) {
      popupMenuItems.push({onClick: onLeaveTeam, title: 'Leave team', danger: true})
    }

    if (yourOperations.manageSubteams) {
      popupMenuItems.push({onClick: onCreateSubteam, title: 'Create subteam'})
    }

    return (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, width: '100%'}}>
        {yourOperations.joinTeam && (
          <Box style={stylesAddYourselfBanner}>
            <Text type="BodySemibold" style={stylesAddYourselfBannerText}>
              You are not a member of this team.
            </Text>
            <Text
              backgroundMode="Information"
              type="BodySemiboldLink"
              style={stylesAddYourselfBannerText}
              onClick={onAddSelf}
              underline={true}
            >
              Add yourself
            </Text>
          </Box>
        )}
        <Box style={stylesTeamHeader}>
          <Avatar isTeam={true} teamname={name} size={64} />
          <Text type="HeaderBig" style={{...globalStyles.selectable, marginTop: globalMargins.tiny}}>
            {name}
          </Text>
          <Text type="BodySmall">TEAM</Text>
          <Text type="BodySmall">
            {memberCount + ' member' + (memberCount !== 1 ? 's' : '')} •{' '}
            {yourRole && Constants.typeToLabel[yourRole]}
          </Text>

          {!loading && (yourOperations.editChannelDescription || description) ? (
            <Text
              style={{
                paddingTop: globalMargins.tiny,
                color: description ? globalColors.black_75 : globalColors.black_20,
              }}
              onClick={yourOperations.editChannelDescription ? onEditDescription : null}
              type={yourOperations.editChannelDescription ? 'BodySecondaryLink' : 'Body'}
            >
              {description || (yourOperations.editChannelDescription && 'Write a brief description')}
            </Text>
          ) : (
            <Box />
          )}

          {yourOperations.manageMembers && (
            <ButtonBar>
              <Button type="Primary" label="Add people" onClick={onAddPeople} />
              {!isMobile && <Button type="Secondary" label="Invite by email" onClick={onInviteByEmail} />}
              {isMobile && <Button type="Secondary" label="Invite contacts" onClick={onInviteByEmail} />}
            </ButtonBar>
          )}
          <Help name={name} />
        </Box>
        <TeamTabs {...this.props} admin={yourOperations.manageMembers} />
        {contents}
        {showMenu &&
          popupMenuItems.length > 0 && (
            <PopupMenu
              items={popupMenuItems}
              onHidden={() => setShowMenu(false)}
              style={{position: 'absolute', right: globalMargins.tiny, top: globalMargins.large}}
            />
          )}
      </Box>
    )
  }
}

const stylesTeamHeader = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  textAlign: 'center',
  paddingLeft: isMobile ? 0 : globalMargins.medium,
  paddingRight: isMobile ? 0 : globalMargins.medium,
  maxWidth: 560,
}

const stylesAddYourselfBanner = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  minHeight: 40,
  marginBottom: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
}

const stylesAddYourselfBannerText = {
  color: globalColors.white,
  textAlign: 'center',
}

export default Team

type CustomProps = {
  onOpenFolder: () => void,
  onManageChat: () => void,
  onShowMenu: () => void,
  canManageChat: boolean,
}

const CustomComponent = ({onOpenFolder, onManageChat, onShowMenu, canManageChat}: CustomProps) => (
  <Box style={{...globalStyles.flexBoxRow, position: 'absolute', right: 0}}>
    {!isMobile &&
      canManageChat && (
        <Icon
          onClick={onManageChat}
          type="iconfont-chat"
          style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
        />
      )}
    {!isMobile &&
      canManageChat && (
        <Icon
          onClick={onOpenFolder}
          type="iconfont-folder-private"
          style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
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
