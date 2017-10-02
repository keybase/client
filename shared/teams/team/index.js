// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import {Avatar, Box, Text, Tabs, List, Icon, PopupMenu, ProgressIndicator} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {isMobile} from '../../constants/platform'

export type RowProps = {
  ...Constants.MemberInfo,
}

export type Props = {
  you: string,
  name: Constants.Teamname,
  members: Array<RowProps>,
  requests: string[],
  loading: boolean,
  setShowMenu: (s: boolean) => void,
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

class Team extends React.PureComponent<Props> {
  _renderItem = (index: number, item: RowProps) => {
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
    const {name, members, requests, setShowMenu, onLeaveTeam, loading, onManageChat} = this.props
    const tabs = [
      <Text
        key="members"
        type="BodySmallSemibold"
        style={{
          color: globalColors.black_75,
        }}
      >
        MEMBERS {(!loading || members.length !== 0) && '(' + members.length + ')'}
      </Text>,
      <Text key="requests" type="BodySmallSemibold" style={{color: globalColors.black_75}}>
        REQUESTS ({requests.length}){' '}
      </Text>,
    ]
    // TODO admin lets us have multiple tabs
    const selectedTab = tabs[0]

    return (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
        <Avatar isTeam={true} teamname={name} size={64} />
        <Text type="Header" style={{marginTop: globalMargins.tiny}}>
          {name}
        </Text>
        <Text type="BodySmall">TEAM</Text>
        <Help name={name} />
        <Tabs tabs={tabs} selected={selectedTab} onSelect={() => {}} />
        {members.length === 0 && loading && <ProgressIndicator style={{alignSelf: 'center', width: 100}} />}
        {(members.length !== 0 || !loading) &&
          <List
            keyProperty="username"
            items={members}
            fixedHeight={48}
            renderItem={this._renderItem}
            style={{alignSelf: 'stretch'}}
          />}
        {this.props.showMenu &&
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
