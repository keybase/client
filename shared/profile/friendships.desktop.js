// @flow
import React, {Component, PureComponent} from 'react'
import ReactList from 'react-list'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {Avatar, Box, ProgressIndicator, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props, FriendshipUserInfo} from './friendships'

type UserEntryProps = FriendshipUserInfo & {
  onClick?: (username: string) => void,
}

class UserEntry extends PureComponent<void, UserEntryProps, void> {
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
    const {username, followsYou, following, thumbnailUrl} = this.props

    return (
      <Box style={userEntryContainerStyle} onClick={this._onClick}>
        <Avatar
          style={userEntryAvatarStyle}
          size={64}
          url={thumbnailUrl}
          followsYou={followsYou}
          following={following}
        />
        <Text type="BodySemibold" style={userEntryUsernameStyle(following)}>{username}</Text>
      </Box>
    )
  }
}

const userEntryContainerStyle = {
  ...globalStyles.clickable,
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

class FriendshipsRender extends Component<void, Props, void> {
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
          <ProgressIndicator />
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
              isYou &&
              <Box style={friendshipEmptyStyle}>
                <Text type="Body" style={{color: globalColors.black_40}}>You have no followers.</Text>
              </Box>}
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
              isYou &&
              <Box style={friendshipEmptyStyle}>
                <Text type="Body" style={{color: globalColors.black_40}}>You are not following anyone.</Text>
              </Box>}
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
}

export default FriendshipsRender
