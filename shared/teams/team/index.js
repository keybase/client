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

export type MemberRowProps = Types.MemberInfo
type InviteRowProps = Types.InviteInfo
type RequestRowProps = Types.RequestInfo

export type Props = {
  description: string,
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
  onLeaveTeam: () => void,
  onManageChat: () => void,
  onSavePublicity: () => void,
  onSetOpenTeamRole: () => void,
  openTeam: boolean,
  openTeamRole: Types.TeamRoleType,
  publicityAnyMember: boolean,
  publicityMember: boolean,
  publicitySettingsChanged: boolean,
  publicityTeam: boolean,
  requests: Array<RequestRowProps>,
  selectedTab: Types.TabKey,
  showAddYourselfBanner: boolean,
  setPublicityAnyMember: (checked: boolean) => void,
  setPublicityMember: (checked: boolean) => void,
  setPublicityTeam: (checked: boolean) => void,
  showMenu: boolean,
  setOpenTeam: (checked: boolean) => void,
  setShowMenu: (s: boolean) => void,
  waitingForSavePublicity: boolean,
  you: string,
  yourRole: ?Types.TeamRoleType,
  youAdmin: boolean,
  youImplicitAdmin: boolean,
  youCanShowcase: boolean,
  youCanAddPeople: boolean,
  youCanCreateSubteam: boolean,
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
      <Text style={{color: globalColors.black_40}} type="BodySmall">{key}</Text>
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
    loading = false,
    selectedTab,
    setSelectedTab,
  } = props
  let membersLabel = 'MEMBERS'
  membersLabel += !loading || members.length !== 0 ? ' (' + members.length + ')' : ''
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
    const invitesLabel = `INVITES (${invites.length})`
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

  const publicityLabel = 'SETTINGS'
  tabs.push(
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
  return <Tabs tabs={tabs} selected={selected} onSelect={onSelect} style={{flexBasis: '100%'}} />
}

class Team extends React.PureComponent<Props> {
  render() {
    const {
      description,
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
      showAddYourselfBanner,
      loading,
      memberCount,
      onManageChat,
      onSavePublicity,
      openTeam,
      openTeamRole,
      publicityAnyMember,
      publicityMember,
      publicitySettingsChanged,
      publicityTeam,
      setOpenTeam,
      setPublicityAnyMember,
      setPublicityMember,
      setPublicityTeam,
      waitingForSavePublicity,
      yourRole,
      youAdmin,
      youImplicitAdmin,
      youCanAddPeople,
      youCanCreateSubteam,
      youCanShowcase,
    } = this.props

    // massage data for rowrenderers
    const memberProps = members.map(member => ({
      username: member.username,
      teamname: name,
      active: member.active,
      key: member.username + member.active.toString(),
    }))
    const requestProps = requests.map(req => ({
      key: req.username,
      teamname: name,
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
        teamname: name,
        username: invite.username,
        id: invite.id,
        type: 'invite',
        key: invite.id,
      }
    })

    let contents
    if (selectedTab === 'members') {
      contents =
        (members.length !== 0 || !loading) &&
        <List
          keyProperty="key"
          items={memberProps}
          fixedHeight={48}
          renderItem={TeamMemberRow}
          style={{alignSelf: 'stretch'}}
        />
    } else if (selectedTab === 'invites') {
      // Show requests first, then invites.
      const requestsAndInvites = requestProps.length > 0
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
            style={{color: globalColors.black_40, textAlign: 'center', marginTop: globalMargins.xlarge}}
          >
            This team has no pending invites.
          </Text>
        )
      } else {
        contents =
          !loading &&
          <List
            items={requestsAndInvites}
            fixedHeight={48}
            keyProperty="key"
            renderItem={TeamRequestOrDividerOrInviteRow}
            style={{alignSelf: 'stretch'}}
          />
      }
    } else if (selectedTab === 'publicity') {
      const teamsLink = 'keybase.io/popular-teams'
      contents = (
        <ScrollView
          style={{...globalStyles.flexBoxColumn, alignSelf: 'stretch', padding: globalMargins.medium}}
        >
          {!youImplicitAdmin &&
            <Box
              style={{
                ...globalStyles.flexBoxRow,
              }}
            >
              <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
                <Checkbox
                  checked={publicityMember}
                  disabled={!youCanShowcase}
                  label=""
                  onCheck={setPublicityMember}
                  style={{paddingRight: globalMargins.xtiny}}
                />
              </Box>
              <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
                <Text style={{color: youCanShowcase ? globalColors.black_75 : globalColors.grey}} type="Body">
                  Publish team on your own profile
                </Text>
                <Text type="BodySmall">
                  {youCanShowcase
                    ? 'Your profile on the Keybase website will mention this team. Description + number of members will be public.'
                    : "Admins aren't allowing members to publish this team on their profile."}
                </Text>
              </Box>
            </Box>}
          {youAdmin &&
            <Box style={globalStyles.flexBoxColumn}>
              <Box style={stylesSettingsTabRow}>
                <Text type="Header">Team</Text>
              </Box>

              <Box style={stylesSettingsTabRow}>
                <Box style={stylesPublicitySettingsBox}>
                  <Checkbox checked={publicityAnyMember} label="" onCheck={setPublicityAnyMember} />
                </Box>
                <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
                  <Text type="Body">
                    Allow non-admin members to publish the team on their profile
                  </Text>
                  <Text type="BodySmall">
                    Team descriptions and number of members will be public.
                  </Text>
                </Box>
              </Box>

              <Box style={stylesSettingsTabRow}>
                <Box style={stylesPublicitySettingsBox}>
                  <Checkbox checked={publicityTeam} label="" onCheck={setPublicityTeam} />
                </Box>
                <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
                  <Text type="Body">
                    Publicize this team on
                    {' '}
                    <Text type="BodyPrimaryLink" onClickURL={`https://${teamsLink}`}>{teamsLink}</Text>
                  </Text>
                  <Text type="BodySmall">
                    Team descriptions and number of members will be public.
                  </Text>
                </Box>
              </Box>

              <Box style={stylesSettingsTabRow}>
                <Box style={stylesPublicitySettingsBox}>
                  <Checkbox
                    checked={openTeam}
                    label=""
                    onCheck={setOpenTeam}
                    style={{paddingRight: globalMargins.xtiny}}
                  />
                </Box>
                <Box
                  style={{...globalStyles.flexBoxColumn, flexShrink: 1, paddingRight: globalMargins.small}}
                >
                  <Text type="Body">
                    Make this an open team
                  </Text>
                  <Text type="BodySmall">
                    Anyone will be able to join immediately.  Users will join as
                    {' '}
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
            </Box>}

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

    const popupMenuItems = [
      {onClick: onManageChat, title: 'Manage chat channels'},
      {onClick: onLeaveTeam, title: 'Leave team', danger: true},
    ]

    if (youCanCreateSubteam) {
      popupMenuItems.push({onClick: onCreateSubteam, title: 'Create subteam'})
    }

    return (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
        {showAddYourselfBanner &&
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
          </Box>}
        <Box style={stylesTeamHeader}>
          <Avatar isTeam={true} teamname={name} size={64} />
          <Text type="Header" style={{marginTop: globalMargins.tiny}}>
            {name}
          </Text>
          <Text type="BodySmall">TEAM</Text>
          <Text type="BodySmall">
            {memberCount + ' member' + (memberCount !== 1 ? 's' : '')}
            {' '}
            •
            {' '}
            {yourRole && Constants.typeToLabel[yourRole]}
          </Text>
          {!loading &&
            (youAdmin || description) &&
            <Text
              style={{
                paddingTop: globalMargins.tiny,
                color: description ? globalColors.black_75 : globalColors.black_20,
              }}
              onClick={youAdmin ? onEditDescription : null}
              type={youAdmin ? 'BodySecondaryLink' : 'Body'}
            >
              {description || (youAdmin && 'Write a brief description')}
            </Text>}

          {youCanAddPeople &&
            <ButtonBar>
              <Button type="Primary" label="Add people" onClick={onAddPeople} />
              {!isMobile &&
                <Button
                  type="Secondary"
                  label="Invite by email"
                  onClick={onInviteByEmail}
                  style={{marginLeft: globalMargins.tiny}}
                />}
              {isMobile &&
                <Button
                  type="Secondary"
                  label="Invite contacts"
                  onClick={onInviteByEmail}
                  style={{marginLeft: globalMargins.tiny}}
                />}
            </ButtonBar>}
          <Help name={name} />
        </Box>
        <TeamTabs {...this.props} admin={youAdmin} />
        {contents}
        {showMenu &&
          <PopupMenu
            items={popupMenuItems}
            onHidden={() => setShowMenu(false)}
            style={{position: 'absolute', right: globalMargins.tiny, top: globalMargins.large}}
          />}
      </Box>
    )
  }
}

const stylesTeamHeader = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  textAlign: 'center',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
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
}

const CustomComponent = ({onOpenFolder, onManageChat, onShowMenu}: CustomProps) => (
  <Box style={{...globalStyles.flexBoxRow, position: 'absolute', right: 0}}>
    {!isMobile &&
      <Icon
        onClick={onManageChat}
        type="iconfont-chat"
        style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
      />}
    {!isMobile &&
      <Icon
        onClick={onOpenFolder}
        type="iconfont-folder-private"
        style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
      />}
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
