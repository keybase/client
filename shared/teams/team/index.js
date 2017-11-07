// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {
  Avatar,
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
  invites: Array<InviteRowProps>,
  isTeamOpen: boolean,
  loading: boolean,
  members: Array<MemberRowProps>,
  name: Constants.Teamname,
  onAddPeople: () => void,
  onInviteByEmail: () => void,
  setSelectedTab: (t: ?Constants.TabKey) => void,
  onCreateSubteam: () => void,
  onLeaveTeam: () => void,
  onManageChat: () => void,
  onClickOpenTeamSetting: () => void,
  publicityMember: boolean,
  publicityTeam: boolean,
  requests: Array<RequestRowProps>,
  selectedTab: Constants.TabKey,
  setPublicityMember: (checked: boolean) => void,
  setPublicityTeam: (checked: boolean) => void,
  showMenu: boolean,
  setShowMenu: (s: boolean) => void,
  you: string,
  youCanAddPeople: boolean,
  youCanCreateSubteam: boolean,
}

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
  requests: Array<RequestRowProps>,
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Constants.TabKey) => void,
}

const TeamTabs = (props: TeamTabsProps) => {
  const {admin, invites, members, requests, loading = false, selectedTab, setSelectedTab} = props
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
  if (admin) {
    const requestsLabel = `REQUESTS (${requests.length})`
    const invitesLabel = `PENDING INVITES (${invites.length})`
    tabs.push(
      <Text
        key="requests"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        {requestsLabel}
      </Text>
    )
    tabs.push(
      <Text
        key="invites"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        {invitesLabel}
      </Text>
    )
  }
  const publicityLabel = 'PUBLICITY SETTINGS'
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
      invites,
      name,
      members,
      requests,
      showMenu,
      setShowMenu,
      onAddPeople,
      onCreateSubteam,
      onInviteByEmail,
      onLeaveTeam,
      selectedTab,
      loading,
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
    const requestProps = requests.map(req => ({username: req.username, teamname: name}))
    const inviteProps = invites.map(invite => ({
      key: invite.email || invite.username,
      email: invite.email,
      teamname: name,
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
    } else if (selectedTab === 'requests') {
      if (requests.length === 0) {
        contents = (
          <Text
            type="BodySmall"
            style={{color: globalColors.black_40, textAlign: 'center', marginTop: globalMargins.xlarge}}
          >
            This team has no pending requests.
          </Text>
        )
      } else {
        contents = (
          <List
            keyProperty="username"
            items={requestProps}
            fixedHeight={48}
            renderItem={TeamRequestRow}
            style={{alignSelf: 'stretch'}}
          />
        )
      }
    } else if (selectedTab === 'invites') {
      if (invites.length === 0) {
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
            items={inviteProps}
            fixedHeight={48}
            renderItem={TeamInviteRow}
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
              paddingLeft: globalMargins.small,
              paddingTop: globalMargins.small,
            }}
          >
            <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
              <Checkbox checked={publicityTeam} label="" onCheck={setPublicityTeam} />
            </Box>
            <Box style={globalStyles.flexBoxColumn}>
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
              paddingLeft: globalMargins.small,
              paddingTop: globalMargins.small,
            }}
          >
            <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
              <Checkbox checked={publicityMember} label="" onCheck={setPublicityMember} />
            </Box>
            <Box style={globalStyles.flexBoxColumn}>
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
        <Avatar isTeam={true} teamname={name} size={64} />
        <Text type="Header" style={{marginTop: globalMargins.tiny}}>
          {name}
        </Text>
        <Text type="BodySmall">TEAM</Text>
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
