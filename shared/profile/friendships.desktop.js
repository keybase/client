// @flow
import React, {Component, PureComponent} from 'react'
import ReactList from 'react-list'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {Box, Avatar, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props, FriendshipUserInfo} from './friendships'

type UserEntryProps = FriendshipUserInfo & {
  onClick?: (username: string) => void,
}

class UserEntry extends PureComponent<void, UserEntryProps, void> {
  _onClick: () => void;

  constructor (props: UserEntryProps) {
    super(props)

    this._updateOnClick(props)
  }

  _updateOnClick (p: UserEntryProps) {
    const {onClick, username, uid} = p
    this._onClick = () => { onClick && onClick(username, uid) }
  }

  componentWillReceiveProps (nextProps: UserEntryProps) {
    this._updateOnClick(nextProps)
  }

  render () {
    const {username, followsYou, following, thumbnailUrl} = this.props

    return <Box style={userEntryContainerStyle} onClick={this._onClick}>
      <Avatar style={userEntryAvatarStyle} size={64} url={thumbnailUrl} followsYou={followsYou} following={following} />
      <Text type='BodySemibold' style={userEntryUsernameStyle(followsYou)}>{username}</Text>
    </Box>
  }
}
//a comment
const userEntryContainerStyle = {
  ...globalStyles.clickable,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 112,
  height: 96,
  display: 'inline-flex',
}

const userEntryAvatarStyle = {
  marginBottom: 2,
}

const userEntryUsernameStyle = followsYou => ({
  color: followsYou ? globalColors.green : globalColors.blue,
  textAlign: 'center',
})

class FriendshipsRender extends Component<void, Props, void> {
  _itemRenderer (followers: boolean, index: number) {
    const user = followers ? this.props.followers[index] : this.props.following[index]
    return <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />
  }

  render () {
    return (
      <TabBar style={this.props.style}>
        <TabBarItem
          selected={this.props.currentTab === 'Followers'}
          label={`FOLLOWERS (${this.props.followers.length})`}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('Followers') }}>
          <ReactList
            style={reactListStyle}
            useTranslate3d={true}
            itemRenderer={(index, key) => this._itemRenderer(true, index)}
            length={this.props.followers.length}
            type='uniform' />
        </TabBarItem>
        <TabBarItem
          selected={this.props.currentTab === 'Following'}
          label={`FOLLOWING (${this.props.following.length})`}
          onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab('Following') }}>
          <ReactList
            style={reactListStyle}
            useTranslate3d={true}
            itemRenderer={(index, key) => this._itemRenderer(false, index)}
            length={this.props.following.length}
            type='uniform' />
        </TabBarItem>
      </TabBar>
    )
  }
}

const reactListStyle = {
  flex: 1,
  paddingTop: globalMargins.small,
  paddingBottom: globalMargins.small,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  borderTop: `solid 1px ${globalColors.black_10}`,
  overflowY: 'auto',
}

export default FriendshipsRender
