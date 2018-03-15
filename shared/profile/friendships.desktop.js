// @flow
import React, {Component, PureComponent} from 'react'
import ReactList from 'react-list'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {Avatar, Box, ProgressIndicator, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../styles'

import type {Props, FriendshipUserInfo} from './friendships'

type UserEntryProps = {
  onClick: (username: string, uid: ?string) => void,
  ...FriendshipUserInfo,
}

class UserEntry extends PureComponent<UserEntryProps> {
  _onClick: () => void

  constructor(props: UserEntryProps) {
    super(props)

    this._updateOnClick(props)
  }

  _updateOnClick(p: UserEntryProps) {
    const {onClick, username, uid} = p
    this._onClick = () => {
      onClick && onClick(username, uid)
    }
  }

  componentWillReceiveProps(nextProps: UserEntryProps) {
    this._updateOnClick(nextProps)
  }

  render() {
    const {username, fullname, followsYou, following} = this.props

    return (
      <Box style={userEntryContainerStyle} onClick={this._onClick}>
        <Avatar
          style={userEntryAvatarStyle}
          size={64}
          username={username}
          followsYou={followsYou}
          following={following}
        />
        <Text type="BodySemibold" className="hover-underline" style={userEntryUsernameStyle(following)}>
          {username}
        </Text>
        <Text type="BodySmall" style={userEntryFullnameStyle}>
          {fullname}
        </Text>
      </Box>
    )
  }
}

const userEntryContainerStyle = {
  ...desktopStyles.clickable,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'flex-start',
  width: 112,
  height: 123,
  padding: globalMargins.xtiny,
  display: 'inline-flex',
}

const userEntryAvatarStyle = {
  marginBottom: 2,
}

const userEntryUsernameStyle = following => ({
  color: following ? globalColors.green : globalColors.blue,
  textAlign: 'center',
})

const userEntryFullnameStyle = {
  color: globalColors.black_40,
  textAlign: 'center',
}

class FriendshipsRender extends Component<Props> {
  _itemRenderer(followers: boolean, index: number) {
    const user = followers ? this.props.followers[index] : this.props.following[index]
    return <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />
  }

  render() {
    const {isYou} = this.props
    const followers = this.props.followers.length
    const following = this.props.following.length

    if (!this.props.followersLoaded) {
      return (
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', paddingTop: 40}}>
          <ProgressIndicator style={{width: 24}} />
        </Box>
      )
    }

    return (
      <TabBar style={this.props.style}>
        <TabBarItem
          selected={this.props.currentTab === 'Followers'}
          label={`FOLLOWERS (${followers})`}
          onClick={() => {
            this.props.onSwitchTab && this.props.onSwitchTab('Followers')
          }}
        >
          <Box style={{marginTop: globalMargins.small}}>
            {followers === 0 &&
              isYou && (
                <Box style={friendshipEmptyStyle}>
                  <Text type="BodySmall">You have no followers.</Text>
                </Box>
              )}
            <ReactList
              useTranslate3d={true}
              itemRenderer={(index, key) => this._itemRenderer(true, index)}
              length={this.props.followers.length}
              type="uniform"
            />
          </Box>
        </TabBarItem>
        <TabBarItem
          selected={this.props.currentTab === 'Following'}
          label={`FOLLOWING (${following})`}
          onClick={() => {
            this.props.onSwitchTab && this.props.onSwitchTab('Following')
          }}
        >
          <Box style={{marginTop: globalMargins.small}}>
            {following === 0 &&
              isYou && (
                <Box style={friendshipEmptyStyle}>
                  <Text type="BodySmall">You are not following anyone.</Text>
                </Box>
              )}
            <ReactList
              useTranslate3d={true}
              itemRenderer={(index, key) => this._itemRenderer(false, index)}
              length={this.props.following.length}
              type="uniform"
            />
          </Box>
        </TabBarItem>
      </TabBar>
    )
  }
}

const friendshipEmptyStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  marginTop: globalMargins.medium,
}

export default FriendshipsRender
