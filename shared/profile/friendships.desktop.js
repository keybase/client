/* @flow */
import React, {Component} from 'react'
import {Box, Avatar, Text} from '../common-adapters'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Props, FriendshipUserInfo} from './friendships'

type UserEntryProps = FriendshipUserInfo & {
  onClick?: (username: string) => void
};

const UserEntry = ({onClick, username, followsYou, following}: UserEntryProps) => (
  <Box style={userEntryContainerStyle} onClick={() => { onClick && onClick(username) }}>
    <Avatar style={userEntryAvatarStyle} size={64} username={username} followsYou={followsYou} following={following} />
    <Text type='BodySmall' style={userEntryUsernameStyle(followsYou)}>{username}</Text>
  </Box>
)

const userEntryContainerStyle = {
  ...globalStyles.clickable,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: '25%',
  height: 96,
}

const userEntryAvatarStyle = {
  marginBottom: 2,
}

const userEntryUsernameStyle = followsYou => ({
  color: followsYou ? globalColors.green : globalColors.blue,
  textAlign: 'center',
})

class Render extends Component<void, Props, void> {
  render () {
    return (
      <TabBar style={this.props.style}>
        <TabBarItem
          selected={this.props.currentTab === 'Followers'}
          label={`FOLLOWERS (${this.props.followers.length})`}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('Followers') }}>
          <Box style={tabItemContainerStyle}>
            {this.props.followers.map(user => <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />)}
          </Box>
        </TabBarItem>
        <TabBarItem
          selected={this.props.currentTab === 'Following'}
          label={`FOLLOWING (${this.props.following.length})`}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('Following') }}>
          <Box style={tabItemContainerStyle}>
            {this.props.following.map(user => <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />)}
          </Box>
        </TabBarItem>
      </TabBar>
    )
  }
}

const tabItemContainerStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  flexWrap: 'wrap',
  paddingTop: globalMargins.small,
  paddingBottom: globalMargins.small,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  borderTop: `solid 1px ${globalColors.black_10}`,
  overflowY: 'auto',
}

export default Render
