// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {Avatar, Box, Text, List, Tabs, Icon, PopupMenu, ProgressIndicator} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {isMobile} from '../../constants/platform'

export type MemberRowProps = {
  ...Constants.MemberInfo,
}

type RequestRowProps = {
  ...Constants.RequestInfo,
}

export type Props = {
  you: string,
  name: Constants.Teamname,
  members: Array<MemberRowProps>,
  requests: string[],
  loading: boolean,
  showMenu: boolean,
  selectedTab: Constants.TabKey,
  setShowMenu: (s: boolean) => void,
  setSelectedTab: (t: ?Constants.TabKey) => void,
  onLeaveTeam: () => void,
  onManageChat: () => void,
}

const typeToLabel = {
  admins: 'Admin',
  owners: 'Owner',
  readers: 'Reader',
  writers: 'Writer',
}

const showCrown = {
  admins: true,
  owners: true,
  readers: false,
  writer: false,
}

const Help = isMobile
  ? () => null
  : ({name}: {name: Constants.Teamname}) => (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', margin: 20}}>
        <Text type="Body" style={{textAlign: 'center'}}>
          Team management in the app is coming soon! In the meantime you can do it from the terminal:
        </Text>
        <Box
          style={{
            backgroundColor: globalColors.midnightBlue,
            borderRadius: 4,
            marginTop: 20,
            padding: 16,
          }}
        >
          <Text type="TerminalComment" backgroundMode="Terminal" style={{display: 'block'}}>
            # Add a member
          </Text>
          <Text
            type="Terminal"
            backgroundMode="Terminal"
            style={{display: 'block', ...globalStyles.selectable}}
          >{`keybase team add-member ${name} --user={user} --role=writer`}</Text>
          <Text type="TerminalComment" backgroundMode="Terminal" style={{display: 'block'}}>
            # Remove a member
          </Text>
          <Text
            type="Terminal"
            backgroundMode="Terminal"
            style={globalStyles.selectable}
          >{`keybase team remove-member ${name} --user={user}`}</Text>
          <Text type="TerminalComment" backgroundMode="Terminal" style={{display: 'block'}}>
            # More commands
          </Text>
          <Text type="Terminal" backgroundMode="Terminal" style={globalStyles.selectable}>
            keybase team --help
          </Text>
        </Box>
      </Box>
    )

type TeamTabsProps = {
  admin: boolean,
  members: Array<MemberRowProps>,
  requests: string[],
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Constants.TabKey) => void,
}

const TeamTabs = (props: TeamTabsProps) => {
  const {admin, members, requests, loading = false, selectedTab, setSelectedTab} = props
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
    // TODO Pending invite tab
    tabs.push(
      ...[
        <Text
          key="requests"
          type="BodySmallSemibold"
          style={{
            color: globalColors.black_75,
          }}
        >
          {requestsLabel}
        </Text>,
      ]
    )
  }
  const selected = tabs.find(tab => tab.key === selectedTab)
  return (
    <Tabs
      tabs={tabs}
      selected={selected}
      // $FlowIssue with tab key
      onSelect={tab => (tab.key ? setSelectedTab(tab.key) : setSelectedTab('members'))}
    />
  )
}

class Team extends React.PureComponent<Props> {
  _renderMember = (index: number, item: MemberRowProps) => {
    return (
      <Box
        key={item.username}
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexShrink: 0,
          height: isMobile ? 56 : 48,
          padding: globalMargins.tiny,
          width: '100%',
        }}
      >
        <Avatar username={item.username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Text type={this.props.you === item.username ? 'BodySemiboldItalic' : 'BodySemibold'}>
            {item.username}
          </Text>
          <Box style={globalStyles.flexBoxRow}>
            {!!showCrown[item.type] &&
              <Icon
                type="iconfont-crown"
                style={{
                  color: globalColors.black_40,
                  fontSize: isMobile ? 16 : 12,
                  marginRight: globalMargins.xtiny,
                }}
              />}
            <Text type="BodySmall">{typeToLabel[item.type]}</Text>
          </Box>
        </Box>
      </Box>
    )
  }

  _renderRequest = (index: number, item: RequestRowProps) => {
    return (
      <Box
        key={item.username}
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexShrink: 0,
          height: isMobile ? 56 : 48,
          padding: globalMargins.tiny,
          width: '100%',
        }}
      >
        <Avatar username={item.username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Text type={this.props.you === item.username ? 'BodySemiboldItalic' : 'BodySemibold'}>
            {item.username}
          </Text>
          <Box style={globalStyles.flexBoxRow}>
            {!!showCrown[item.type] &&
              <Icon
                type="iconfont-crown"
                style={{
                  color: globalColors.black_40,
                  fontSize: isMobile ? 16 : 12,
                  marginRight: globalMargins.xtiny,
                }}
              />}
            <Text type="BodySmall">{typeToLabel[item.type]}</Text>
          </Box>
        </Box>
      </Box>
    )
  }

  render() {
    const {
      name,
      members,
      requests,
      showMenu,
      setShowMenu,
      onLeaveTeam,
      selectedTab,
      loading,
      onManageChat,
      you,
    } = this.props

    // TODO admin lets us have multiple tabs
    const me = members.find(member => member.username === you)
    const admin = me ? showCrown[me.type] : false
    const progressIndicator =
      members.length === 0 && loading && <ProgressIndicator style={{alignSelf: 'center', width: 100}} />

    let contents
    if (selectedTab === 'members') {
      contents =
        (members.length !== 0 || !loading) &&
        <List
          keyProperty="username"
          items={members}
          fixedHeight={48}
          renderItem={this._renderMember}
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
            items={requests}
            fixedHeight={48}
            renderItem={this._renderRequest}
            style={{alignSelf: 'stretch'}}
          />
        )
      }
    }

    return (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
        <Avatar isTeam={true} teamname={name} size={64} />
        <Text type="Header" style={{marginTop: globalMargins.tiny}}>
          {name}
        </Text>
        <Text type="BodySmall">TEAM</Text>
        <Help name={name} />
        <TeamTabs {...this.props} admin={admin} />
        {progressIndicator}
        {contents}
        {showMenu &&
          <PopupMenu
            items={[
              {onClick: onManageChat, title: 'Manage chat channels'},
              {onClick: onLeaveTeam, title: 'Leave team', danger: true},
            ]}
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
