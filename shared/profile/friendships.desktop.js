// @flow
// TODO deprecate
import React, {Component, PureComponent} from 'react'
import ReactList from 'react-list'
import TabBar, {TabBarItem} from '../common-adapters/tab-bar'
import {Avatar, Box, ProgressIndicator, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../styles'
import * as Types from '../constants/types/profile'

type Props = {
  username: string,
  isYou: boolean,
  style?: ?Object,
  currentTab: Types.FriendshipsTab,
  onSwitchTab?: (selected: Types.FriendshipsTab) => void,
  onUserClick?: (username: string) => void,
  followersLoaded: boolean,
  followers: Array<Types.FriendshipUserInfo>,
  following: Array<Types.FriendshipUserInfo>,
}

type UserEntryProps = {
  onClick: (username: string, uid: ?string) => void,
  ...Types.FriendshipUserInfo,
}

class UserEntry extends PureComponent<UserEntryProps> {
  _onClick: () => void

  constructor(props: UserEntryProps) {
    super(props)
    this._updateOnClick(props)
  }

  _updateOnClick(p: UserEntryProps) {
    const {onClick, username, uid} = p
    // TODO we shouldn't be doing this
    this._onClick = () => {
      onClick && onClick(username, uid)
    }
  }

  componentDidUpdate(prevProps: UserEntryProps) {
    this._updateOnClick(this.props)
  }

  render() {
    const {username, fullname, following} = this.props

    return (
      <Box style={userEntryContainerStyle} onClick={this._onClick}>
        <Avatar style={userEntryAvatarStyle} size={64} username={username} showFollowingStatus={true} />
        <Text
          center={true}
          type="BodySemibold"
          className="hover-underline"
          style={userEntryUsernameStyle(following)}
        >
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
  display: 'inline-flex',
  height: 123,
  justifyContent: 'flex-start',
  padding: globalMargins.xtiny,
  width: 112,
}

const userEntryAvatarStyle = {
  marginBottom: 2,
}

const userEntryUsernameStyle = following => ({
  color: following ? globalColors.green : globalColors.blue,
})

const userEntryFullnameStyle = {
  color: globalColors.black_50,
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
            {followers === 0 && isYou && (
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
            {following === 0 && isYou && (
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
