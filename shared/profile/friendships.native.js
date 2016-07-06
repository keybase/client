/* @flow */
import React, {Component} from 'react'
import {TouchableHighlight} from 'react-native'
import {Box, Avatar, Text} from '../common-adapters'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props, FriendshipUserInfo} from './friendships'

const ITEM_WIDTH = 105

type UserEntryProps = FriendshipUserInfo & {
  onClick?: (username: string) => void
}

const UserEntry = ({onClick, username, followsYou, following}: UserEntryProps) => (
  <TouchableHighlight onPress={() => { onClick && onClick(username) }}>
    <Box style={userEntryContainerStyle}>
      <Avatar style={userEntryAvatarStyle} size={64} username={username} followsYou={followsYou} following={following} />
      <Text type='BodySmall' style={userEntryUsernameStyle(followsYou)}>{username}</Text>
    </Box>
  </TouchableHighlight>
)

// Pad an array of grid entries with enough placeholders to fill the final row
function padGridEntries (entries, multiple) {
  for (let i = 0; i < entries.length % multiple; i++) {
    entries.push(<Box key={`pad${i}`} style={{width: ITEM_WIDTH, margin: 2}} />)
  }
  return entries
}

const userEntryContainerStyle = {
  ...globalStyles.clickable,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'flex-start',
  width: ITEM_WIDTH,
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
          selected={this.props.currentTab === 'Followers'}
          label={'FOLLOWERS'}
          styleContainer={{flex: 1}}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('Followers') }}>
          <Box style={tabItemContainerStyle}>
            <Box style={tabItemContainerTopBorder} />
            <Box style={tabItemContainerUsers}>
              {padGridEntries(this.props.followers.map(user => <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />), 3)}
            </Box>
          </Box>
        </TabBarItem>
        <TabBarItem
          selected={this.props.currentTab === 'Following'}
          label={'FOLLOWING'}
          styleContainer={{flex: 1}}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('Following') }}>
          <Box style={tabItemContainerStyle}>
            <Box style={tabItemContainerTopBorder} />
            <Box style={tabItemContainerUsers}>
              {padGridEntries(this.props.following.map(user => <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />), 3)}
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
}

const tabItemContainerTopBorder = {
  flex: 1,
  height: 1,
  backgroundColor: globalColors.black_10,
  alignSelf: 'stretch',
}

const tabItemContainerUsers = {
  ...globalStyles.flexBoxRow,
  flexWrap: 'wrap',
  justifyContent: 'space-around',
  paddingTop: 8,
}

export default Render
