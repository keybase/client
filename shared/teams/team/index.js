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
  Checkbox,
  ClickableBox,
  Text,
  Tabs,
  List,
  Icon,
  PopupMenu,
  ProgressIndicator,
  ScrollView,
} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'
import TeamInviteRow from './invite-row/container'
import TeamMemberRow from './member-row/container'
import TeamRequestRow from './request-row/container'
import TeamSubteamRow from './subteam-row/container'
import SubteamBanner from './subteam-banner'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as I from 'immutable'

export type MemberRowProps = Types.MemberInfo
type InviteRowProps = Types.InviteInfo
type RequestRowProps = Types.RequestInfo

export type Props = {
  description: string,
  ignoreAccessRequests: boolean,
  invites: Array<InviteRowProps>,
  isTeamOpen: boolean,
  newTeamRequests: Array<Types.Teamname>,
  loading: boolean,
  members: Array<MemberRowProps>,
  memberCount: number,
  name: Types.Teamname,
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
  onSavePublicity: () => void,
  onSetOpenTeamRole: () => void,
  openTeam: boolean,
  openTeamRole: Types.TeamRoleType,
  publicityAnyMember: boolean,
  publicityMember: boolean,
  publicitySettingsChanged: boolean,
  publicityTeam: boolean,
  requests: Array<RequestRowProps>,
  sawSubteamsBanner: boolean,
  selectedTab: Types.TabKey,
  showAddYourselfBanner: boolean,
  setIgnoreAccessRequests: (checked: boolean) => void,
  setPublicityAnyMember: (checked: boolean) => void,
  setPublicityMember: (checked: boolean) => void,
  setPublicityTeam: (checked: boolean) => void,
  showMenu: boolean,
  setOpenTeam: (checked: boolean) => void,
  setShowMenu: (s: boolean) => void,
  subteams: I.List<Types.Teamname>,
  waitingForSavePublicity: boolean,
  you: string,
  yourRole: ?Types.TeamRoleType,
  yourOperations: RPCTypes.TeamOperation,
}

const TeamDividerRow = (index, {key}) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: globalMargins.medium,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
      <Text style={{color: globalColors.black_40}} type="BodySmall">
        {key}
      </Text>
    </Box>
  </Box>
)

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
  invites: Array<InviteRowProps>,
  members: Array<MemberRowProps>,
  name: Types.Teamname,
  newTeamRequests: Array<Types.Teamname>,
  requests: Array<RequestRowProps>,
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Types.TabKey) => void,
  subteams: I.List<Types.Teamname>,
  yourOperations: RPCTypes.TeamOperation,
}

const SubteamsIntro = ({row}) => (
  <SubteamBanner
    onHideSubteamsBanner={row.onHideSubteamsBanner}
    onReadMore={row.onReadMore}
    teamname={row.teamname}
  />
)

const SubteamRow = ({row}) => (
  <Box>
    <TeamSubteamRow teamname={row.teamname} />
  </Box>
)

const AddSubTeam = ({row}) => (
  <Box
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
      return <SubteamsIntro key={row.key} row={row} />
    case 'addSubteam':
      return <AddSubTeam key={row.key} row={row} />
    case 'noSubteams':
      return <NoSubteams key={row.key} row={row} />
    default:
      return <SubteamRow key={row.key} row={row} />
  }
}

const TeamRequestOrDividerOrInviteRow = (index, row) => {
  switch (row.type) {
    case 'request':
      return TeamRequestRow(index, row)
    case 'invite':
      return TeamInviteRow(index, row)
    default:
      return TeamDividerRow(index, row)
  }
}

const TeamTabs = (props: TeamTabsProps) => {
  const {
    admin,
    invites,
    members,
    name,
    newTeamRequests,
    requests,
    subteams,
    loading = false,
    selectedTab,
    setSelectedTab,
    yourOperations,
  } = props
  let membersLabel = 'MEMBERS'
  membersLabel += !loading && members.length !== 0 ? ` (${members.length})` : ''
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
      requests.length
    )
  }

  if (admin) {
    let invitesLabel = 'INVITES'
    invitesLabel += !loading && invites.length !== 0 ? ` (${invites.length})` : ''
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
      ignoreAccessRequests,
      invites,
      name,
      members,
      requests,
      showMenu,
      setShowMenu,
      onAddPeople,
      onAddSelf,
      onCreateSubteam,
      onEditDescription,
      onInviteByEmail,
      onLeaveTeam,
      onSetOpenTeamRole,
      selectedTab,
      loading,
      memberCount,
      onHideSubteamsBanner,
      onManageChat,
      onReadMoreAboutSubteams,
      onSavePublicity,
      openTeam,
      openTeamRole,
      publicityAnyMember,
      publicityMember,
      publicitySettingsChanged,
      publicityTeam,
      sawSubteamsBanner,
      setIgnoreAccessRequests,
      setOpenTeam,
      setPublicityAnyMember,
      setPublicityMember,
      setPublicityTeam,
      subteams,
      waitingForSavePublicity,
      yourRole,
      yourOperations,
    } = this.props

    const teamname = name
    // massage data for rowrenderers
    const memberProps = members.map(member => ({
      fullName: member.fullName,
      username: member.username,
      teamname,
      active: member.active,
      key: member.username + member.active.toString(),
    }))
    const requestProps = requests.map(req => ({
      key: req.username,
      teamname,
      type: 'request',
      username: req.username,
    }))
    const inviteProps = invites.map(invite => {
      let inviteInfo
      if (invite.name) {
        inviteInfo = {name: invite.name}
      } else if (invite.email) {
        inviteInfo = {email: invite.email}
      } else if (invite.username) {
        inviteInfo = {username: invite.username}
      }
      return {
        ...inviteInfo,
        teamname,
        username: invite.username,
        id: invite.id,
        type: 'invite',
        key: invite.id,
      }
    })

    let contents
    if (selectedTab === 'members') {
      contents = (members.length !== 0 || !loading) && (
        <List
          keyProperty="key"
          items={memberProps}
          fixedHeight={48}
          renderItem={TeamMemberRow}
          style={{alignSelf: 'stretch'}}
        />
      )
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
          keyProperty="key"
          renderItem={subTeamsRow}
          style={{alignSelf: 'stretch'}}
        />
      )
    } else if (selectedTab === 'invites') {
      // Show requests first, then invites.
      const requestsAndInvites =
        requestProps.length > 0
          ? [
              {key: 'Requests', type: 'divider'},
              ...requestProps,
              {key: 'Invites', type: 'divider'},
              ...inviteProps,
            ]
          : [...requestProps, ...inviteProps]
      if (requestsAndInvites.length === 0) {
        contents = (
          <Text
            type="BodySmall"
            style={{color: globalColors.black_40, marginTop: globalMargins.xlarge, textAlign: 'center'}}
          >
            This team has no pending invites.
          </Text>
        )
      } else {
        contents = !loading && (
          <List
            items={requestsAndInvites}
            fixedHeight={48}
            keyProperty="key"
            renderItem={TeamRequestOrDividerOrInviteRow}
            style={{alignSelf: 'stretch'}}
          />
        )
      }
    } else if (selectedTab === 'publicity') {
      const teamsLink = 'keybase.io/popular-teams'
      contents = (
        <ScrollView
          style={{
            ...globalStyles.flexBoxColumn,
            alignSelf: 'stretch',
            flexBasis: 0,
            flexGrow: 1,
          }}
          contentContainerStyle={{padding: globalMargins.medium}}
        >
          <Box
            style={{
              ...globalStyles.flexBoxRow,
            }}
          >
            <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
              <Checkbox
                checked={publicityMember}
                disabled={!yourOperations.setMemberShowcase}
                label=""
                onCheck={setPublicityMember}
                style={{paddingRight: globalMargins.xtiny}}
              />
            </Box>
            <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
              <Text
                style={{
                  color: yourOperations.setMemberShowcase ? globalColors.black_75 : globalColors.grey,
                }}
                type="Body"
              >
                Publish team on your own profile
              </Text>
              <Text type="BodySmall">
                {yourOperations.setMemberShowcase
                  ? 'Your profile will mention this team. Team description and number of members will be public.'
                  : "Admins aren't allowing members to publish this team on their profile."}
              </Text>
            </Box>
          </Box>

          {(yourOperations.changeOpenTeam ||
            yourOperations.setTeamShowcase ||
            yourOperations.setPublicityAny) && (
            <Box style={globalStyles.flexBoxColumn}>
              <Box style={stylesSettingsTabRow}>
                <Text type="Header">Team</Text>
              </Box>
              {yourOperations.setPublicityAny && (
                <Box style={stylesSettingsTabRow}>
                  <Box style={stylesPublicitySettingsBox}>
                    <Checkbox checked={publicityAnyMember} label="" onCheck={setPublicityAnyMember} />
                  </Box>
                  <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
                    <Text type="Body">Allow non-admin members to publish the team on their profile</Text>
                    <Text type="BodySmall">Team descriptions and number of members will be public.</Text>
                  </Box>
                </Box>
              )}
              {yourOperations.setTeamShowcase && (
                <Box style={stylesSettingsTabRow}>
                  <Box style={stylesPublicitySettingsBox}>
                    <Checkbox checked={publicityTeam} label="" onCheck={setPublicityTeam} />
                  </Box>
                  <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
                    <Text type="Body">
                      Publicize this team on{' '}
                      <Text type="BodyPrimaryLink" onClickURL={`https://${teamsLink}`}>
                        {teamsLink}
                      </Text>
                    </Text>
                    <Text type="BodySmall">Team descriptions and number of members will be public.</Text>
                  </Box>
                </Box>
              )}
              {yourOperations.changeOpenTeam && (
                <Box style={stylesSettingsTabRow}>
                  <Box style={stylesPublicitySettingsBox}>
                    <Checkbox checked={openTeam} label="" onCheck={setOpenTeam} />
                  </Box>
                  <Box
                    style={{...globalStyles.flexBoxColumn, flexShrink: 1, paddingRight: globalMargins.small}}
                  >
                    <Text type="Body">Make this an open team</Text>
                    <Text type="BodySmall">
                      Anyone will be able to join immediately. Users will join as{' '}
                      <Text
                        type={openTeam ? 'BodySmallPrimaryLink' : 'BodySmall'}
                        onClick={openTeam ? onSetOpenTeamRole : undefined}
                      >
                        {openTeamRole}
                      </Text>
                      .
                    </Text>
                  </Box>
                </Box>
              )}
              {yourOperations.changeTarsDisabled && (
                <Box style={stylesSettingsTabRow}>
                  <Box style={stylesPublicitySettingsBox}>
                    <Checkbox checked={ignoreAccessRequests} label="" onCheck={setIgnoreAccessRequests} />
                  </Box>
                  <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
                    <Text type="Body">Ignore requests to join this team</Text>
                    <Text type="BodySmall">Admins won't be bothered by hordes of fans.</Text>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          <Box
            style={{
              ...stylesSettingsTabRow,
              justifyContent: 'center',
              paddingBottom: isMobile ? globalMargins.tiny : globalMargins.small,
              paddingTop: isMobile ? globalMargins.tiny : globalMargins.small,
            }}
          >
            <Button
              type="Primary"
              label="Save"
              onClick={onSavePublicity}
              disabled={!publicitySettingsChanged}
              waiting={waitingForSavePublicity}
            />
          </Box>
        </ScrollView>
      )
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

const stylesPublicitySettingsBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingRight: globalMargins.small,
}

const stylesSettingsTabRow = {
  ...globalStyles.flexBoxRow,
  paddingTop: globalMargins.small,
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
