/* @flow */
import React, {Component} from 'react'
import {Box, Avatar, Text} from '../common-adapters'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props, UserInfo} from './friendships'

type UserEntryProps = UserInfo & {
  onClick?: (username: string) => void
}

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
  justifyContent: 'flex-start',
  width: 105,
  height: 108,
  margin: 2,
}

const userEntryAvatarStyle = {
  marginBottom: 2,
  marginTop: 2,
}

const userEntryUsernameStyle = followsYou => ({
  color: followsYou ? globalColors.green : globalColors.blue,
  textAlign: 'center',
})

class Render extends Component<void, Props, void> {
  render () {
    return (
      <TabBar>
        <TabBarItem
          selected={this.props.currentTab === 'FOLLOWERS'}
          label={'FOLLOWERS'}
          styleContainer={{flex: 1}}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('FOLLOWERS') }}>
          <Box style={tabItemContainerStyle}>
            <Box style={tabItemContainerTopBorder} />
            <Box style={tabItemContainerUsers}>
              {this.props.followers.map(user => <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />)}
            </Box>
          </Box>
        </TabBarItem>
        <TabBarItem
          selected={this.props.currentTab === 'FOLLOWING'}
          label={'FOLLOWING'}
          styleContainer={{flex: 1}}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('FOLLOWING') }}>
          <Box style={tabItemContainerStyle}>
            <Box style={tabItemContainerTopBorder} />
            <Box style={tabItemContainerUsers}>
              {this.props.following.map(user => <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />)}
            </Box>
          </Box>
        </TabBarItem>
      </TabBar>
    )
  }
}

const tabItemContainerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  backgroundColor: globalColors.lightGrey,
}

const tabItemContainerTopBorder = {
  flex: 1,
  height: 1,
  backgroundColor: globalColors.black_10,
  alignSelf: 'stretch',
}

const tabItemContainerUsers = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  flexWrap: 'wrap',
  justifyContent: 'space-around',
  paddingTop: 8,
}

export default Render
