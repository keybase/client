// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Text,
  Tabs,
  List,
  Icon,
  PopupMenu,
  ProgressIndicator,
} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {isMobile} from '../../constants/platform'
import {OpenTeamSettingButton} from '../open-team'
import TeamInviteRow from './invite-row/container'
import TeamMemberRow from './member-row/container'
import TeamRequestRow from './request-row/container'
import flags from '../../util/feature-flags'

export type MemberRowProps = Constants.MemberInfo
type InviteRowProps = Constants.InviteInfo
type RequestRowProps = Constants.RequestInfo

export type Props = {
  description: string,
  invites: Array<InviteRowProps>,
  isTeamOpen: boolean,
  newTeamRequests: Array<Constants.Teamname>,
  loading: boolean,
  members: Array<MemberRowProps>,
  memberCount: number,
  name: Constants.Teamname,
  onAddPeople: () => void,
  onAddSelf: () => void,
  onInviteByEmail: () => void,
  setSelectedTab: (t: ?Constants.TabKey) => void,
  onCreateSubteam: () => void,
  onEditDescription: () => void,
  onLeaveTeam: () => void,
  onManageChat: () => void,
  onClickOpenTeamSetting: () => void,
  publicityMember: boolean,
  publicityTeam: boolean,
  requests: Array<RequestRowProps>,
  selectedTab: Constants.TabKey,
  showAddYourselfBanner: boolean,
  setPublicityMember: (checked: boolean) => void,
  setPublicityTeam: (checked: boolean) => void,
  showMenu: boolean,
  setShowMenu: (s: boolean) => void,
  you: string,
  youCanAddPeople: boolean,
  youCanCreateSubteam: boolean,
}

const TeamDividerRow = (index, {title}) =>
  <Box
    key={index+title}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: globalMargins.medium,
      padding: globalMargins.tiny,
      width: '100%',
      }}
  >
    <Box key={index+title+'box'} style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
      <Text key={index+title+'text'} style={{color: globalColors.black_40}} type="BodySmall">{title}</Text>
    </Box>
  </Box>

const Help = isMobile
  ? () => null
  : ({name}: {name: Constants.Teamname}) => (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', margin: 20}}>
        <Text type="Body" style={{textAlign: 'center'}}>
          You can also manage teams from the terminal:
          <Text type="TerminalInline" style={{...globalStyles.selectable, marginLeft: globalMargins.tiny}}>
            keybase team --help
          </Text>
        </Text>
      </Box>
    )

type TeamTabsProps = {
  admin: boolean,
  invites: Array<InviteRowProps>,
  members: Array<MemberRowProps>,
  name: Constants.Teamname,
  newTeamRequests: Array<Constants.Teamname>,
  requests: Array<RequestRowProps>,
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Constants.TabKey) => void,
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
  if (admin) {
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
  }
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
  return <Tabs tabs={tabs} selected={selected} onSelect={onSelect} />
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
      selectedTab,
      showAddYourselfBanner,
      loading,
      memberCount,
      onManageChat,
      publicityMember,
      publicityTeam,
      setPublicityMember,
      setPublicityTeam,
      you,
      youCanAddPeople,
      youCanCreateSubteam,
    } = this.props

    const me = members.find(member => member.username === you)
    const admin = me ? me.type === 'admin' || me.type === 'owner' : false

    // massage data for rowrenderers
    const memberProps = members.map(member => ({username: member.username, teamname: name}))
    const requestProps = requests.map(req => ({type: 'request', teamname: name, username: req.username}))
    const inviteProps = invites.map(invite => ({
      email: invite.email,
      key: invite.email || invite.username,
      teamname: name,
      type: 'invite',
      username: invite.username,
    }))
    let contents
    if (selectedTab === 'members') {
      contents =
        (members.length !== 0 || !loading) &&
        <List
          keyProperty="username"
          items={memberProps}
          fixedHeight={48}
          renderItem={TeamMemberRow}
          style={{alignSelf: 'stretch'}}
        />
    } else if (selectedTab === 'invites') {
      // Show requests first, then invites.
      const requestsAndInvites = [
        {type: 'divider', title: 'Requests'},
        ...requestProps,
        {type: 'divider', title: 'Invites'},
        ...inviteProps,
      ]
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
            keyProperty="key"
            items={requestsAndInvites}
            fixedHeight={48}
            renderItem={TeamRequestOrDividerOrInviteRow}
            style={{alignSelf: 'stretch'}}
          />
      }
    } else if (selectedTab === 'publicity') {
      const teamsLink = 'keybase.io/popular-teams'
      contents = (
        <Box style={{...globalStyles.flexBoxColumn, alignSelf: 'stretch'}}>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              paddingLeft: globalMargins.tiny,
              paddingTop: globalMargins.small,
            }}
          >
            <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
              <Checkbox
                checked={publicityTeam}
                label=""
                onCheck={setPublicityTeam}
                style={{paddingRight: globalMargins.xtiny}}
              />
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

          <Box
            style={{
              ...globalStyles.flexBoxRow,
              paddingLeft: globalMargins.tiny,
              paddingTop: globalMargins.small,
            }}
          >
            <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
              <Checkbox
                checked={publicityMember}
                label=""
                onCheck={setPublicityMember}
                style={{paddingRight: globalMargins.xtiny}}
              />
            </Box>
            <Box style={{...globalStyles.flexBoxColumn, flexShrink: 1}}>
              <Text type="Body">
                Publish on your own profile that you're an admin of this team
              </Text>
              <Text type="BodySmall">
                Team description and number of members will be public.
              </Text>
            </Box>
          </Box>
        </Box>
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
          {me && me.type && Constants.typeToLabel[me.type]}
        </Text>
        <Text
          style={{
            paddingTop: globalMargins.tiny,
            color: description ? globalColors.black : globalColors.black_20,
          }}
          onClick={onEditDescription}
          type={'BodySecondaryLink'}
        >
          {description || 'Write a brief description'}
        </Text>

        {youCanAddPeople &&
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginTop: globalMargins.small}}>
            <Button type="Primary" label="Add people" onClick={onAddPeople} />
            {!isMobile &&
              <Button
                type="Secondary"
                label="Invite by email"
                onClick={onInviteByEmail}
                style={{marginLeft: globalMargins.tiny}}
              />}
            {isMobile &&
              flags.inviteContactsEnabled &&
              <Button
                type="Secondary"
                label="Invite contacts"
                onClick={onInviteByEmail}
                style={{marginLeft: globalMargins.tiny}}
              />}
          </Box>}
        <Help name={name} />
        {admin &&
          <Box style={{marginTop: globalMargins.medium, marginBottom: globalMargins.medium}}>
            <OpenTeamSettingButton
              onClick={this.props.onClickOpenTeamSetting}
              isOpen={this.props.isTeamOpen}
            />
          </Box>}
        <TeamTabs {...this.props} admin={admin} />
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
