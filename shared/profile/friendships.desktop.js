/* @flow */
import React, {Component} from 'react'
import {Box, Avatar, Text} from '../common-adapters'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props, UserInfo} from './friendships'

type UserEntryProps = UserInfo & {
  onClick?: (username: string) => void
};

class RenderUserEntry extends Component<void, UserEntryProps, void> {
  render () {
    return (
      <Box
        style={userEntryContainerStyle}
        onClick={() => { this.props.onClick && this.props.onClick(this.props.username) }}>
        <Avatar
          style={userEntryAvatarStyle}
          size={48}
          username={this.props.username}
          followsYou={this.props.followsYou}
          following={this.props.following} />
        <Text type='BodySmall' style={userEntryUsernameStyle(this.props.followsYou)}>{this.props.username}</Text>
        <Text type='BodySmall' style={userEntryFullnameStyle}>{this.props.fullname}</Text>
      </Box>
    )
  }
}

const userEntryContainerStyle = {
  ...globalStyles.clickable,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 130,
  height: 130
}

const userEntryAvatarStyle = {
  marginBottom: 2
}

const userEntryUsernameStyle = followsYou => ({
  color: followsYou ? globalColors.green : globalColors.blue
})

const userEntryFullnameStyle = {
  color: globalColors.black_40
}

class Render extends Component<void, Props, void> {
  render () {
    return (
      <Box>
        <TabBar>
          <TabBarItem
            selected={this.props.currentTab === 'FOLLOWERS'}
            label={`FOLLOWERS (${this.props.followers.length})`}
            onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('FOLLOWERS') }}>
            <Box style={tabItemContainerStyle}>
              {this.props.followers.map(user => <RenderUserEntry key={user.username} {...user} />)}
            </Box>
          </TabBarItem>
          <TabBarItem
            selected={this.props.currentTab === 'FOLLOWING'}
            label={`FOLLOWING (${this.props.following.length})`}
            onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('FOLLOWING') }}>
            <Box style={tabItemContainerStyle}>
              {this.props.following.map(user => <RenderUserEntry key={user.username} {...user} />)}
            </Box>
          </TabBarItem>
        </TabBar>
      </Box>
    )
  }
}

const tabItemContainerStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  flexWrap: 'wrap',
  borderTop: `solid 1px ${globalColors.black_10}`
}

export default Render
