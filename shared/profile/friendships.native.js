// @flow
import React, {Component} from 'react'
import chunk from 'lodash/chunk'
import {
  Box,
  Avatar,
  Text,
  ClickableBox,
  TabBar,
  NativeListView,
  NativeDimensions,
  ProgressIndicator,
} from '../common-adapters/index.native'
import {TabBarItem} from '../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props, FriendshipUserInfo} from './friendships'

type UserEntryProps = FriendshipUserInfo & {
  onClick?: (username: string) => void,
}

const UserEntry = ({onClick, username, followsYou, following, thumbnailUrl}: UserEntryProps) => (
  <ClickableBox
    onClick={() => {
      onClick && onClick(username)
    }}
    style={userEntryContainerStyle}
  >
    <Box style={userEntryInnerContainerStyle}>
      <Avatar
        style={userEntryAvatarStyle}
        size={64}
        url={thumbnailUrl}
        followsYou={followsYou}
        following={following}
      />
      <Text type="BodySemibold" style={userEntryUsernameStyle(following)}>{username}</Text>
    </Box>
  </ClickableBox>
)

const userEntryContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingBottom: globalMargins.small,
  paddingTop: globalMargins.small,
  width: 105,
}

const userEntryInnerContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: 108,
  justifyContent: 'flex-start',
}

const userEntryAvatarStyle = {
  marginBottom: globalMargins.xtiny,
  marginTop: 2,
}

const userEntryUsernameStyle = following => ({
  color: following ? globalColors.green : globalColors.blue,
  textAlign: 'center',
})

type State = {
  dataSource: any,
}

class FriendshipsRender extends Component<void, Props, State> {
  state: State = {
    dataSource: null,
  }
  _dataSource = new NativeListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

  _setDataSource = props => {
    const data = props.currentTab === 'Followers' ? props.followers : props.following
    const dataSource = this._dataSource.cloneWithRows(chunk(data || [], 3))
    this.setState({dataSource})
  }

  componentWillMount() {
    this._setDataSource(this.props)
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.currentTab !== nextProps.currentTab) {
      this._setDataSource(nextProps)
    } else if (this.props.currentTab === 'Followers' && this.props.followers !== nextProps.followers) {
      this._setDataSource(nextProps)
    } else if (this.props.currentTab === 'Following' && this.props.following !== nextProps.following) {
      this._setDataSource(nextProps)
    }
  }

  _renderRow = users => {
    return (
      <Box style={{...globalStyles.flexBoxRow, width: '100%', height: 108, justifyContent: 'space-around'}}>
        {[0, 1, 2].map(idx => {
          const user = users[idx]
          if (user) {
            return <UserEntry key={user.username} {...user} onClick={this.props.onUserClick} />
          } else {
            return null
          }
        })}
      </Box>
    )
  }

  render() {
    if (!this.props.followersLoaded) {
      return (
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', paddingBottom: 20, paddingTop: 2}}>
          <ProgressIndicator />
        </Box>
      )
    }

    const {height} = NativeDimensions.get('window')
    const {isYou} = this.props
    const textWhenEmptyYou = {
      Followers: 'You have no followers.',
      Following: 'You are not following anyone.',
    }
    const textWhenEmpty = {
      Followers: this.props.username + ' has no followers.',
      Following: this.props.username + ' is not following anyone.',
    }
    const counts = {
      Followers: this.props.followers.length,
      Following: this.props.following.length,
    }

    const barHeight = height - 115
    return (
      <TabBar style={{height: barHeight, maxHeight: barHeight}}>
        {['Followers', 'Following'].map(tab => {
          return (
            <TabBarItem
              key={tab}
              selected={this.props.currentTab === tab}
              label={`${tab.toUpperCase()} (${counts[tab]})`}
              onClick={() => {
                this.props.onSwitchTab && this.props.onSwitchTab(tab)
              }}
            >
              <Box style={globalStyles.flexGrowOne}>
                <Box style={globalStyles.fillAbsolute}>
                  <Box style={{...tabItemContainerStyle, width: '100%'}}>
                    <Box style={tabItemContainerTopBorder} />
                    {counts[tab] === 0 &&
                      <Box style={tabItemEmptyStyle}>
                        <Text type="BodySmall" style={{color: globalColors.black_40}}>
                          {isYou ? textWhenEmptyYou[tab] : textWhenEmpty[tab]}
                        </Text>
                      </Box>}
                    <Box style={tabItemContainerUsers}>
                      {this.props.currentTab === tab &&
                        !!this.state.dataSource &&
                        <NativeListView
                          enableEmptySections={true}
                          dataSource={this.state.dataSource}
                          renderRow={this._renderRow}
                        />}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </TabBarItem>
          )
        })}
      </TabBar>
    )
  }
}

const tabItemContainerStyle = {
  ...globalStyles.flexBoxColumn,
}

const tabItemContainerTopBorder = {
  alignSelf: 'stretch',
  backgroundColor: globalColors.black_10,
  width: '100%',
  height: 1,
  maxHeight: 1,
}

const tabItemContainerUsers = {
  ...globalStyles.flexBoxRow,
  flexWrap: 'wrap',
  justifyContent: 'space-around',
  minHeight: 160,
}

const tabItemEmptyStyle = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
  minHeight: 160,
}

export default FriendshipsRender
