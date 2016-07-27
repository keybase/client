// @flow
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, TabBar} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import List from './list'
import FoldersHelp from './help.desktop'
import {globalStyles, globalColors} from '../styles/style-guide'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <FoldersHelp username={this.props.username} />
  }

  _makeItem (isPublic: boolean, isSelected: boolean) {
    const icon = isPublic ? 'iconfont-folder-public' : 'iconfont-folder-private'
    const selectedColor = isPublic ? globalColors.yellowGreen : globalColors.darkBlue2
    const iconStyle = isPublic
      ? {color: globalColors.yellowGreen, marginBottom: isSelected ? 0 : 0, opacity: isSelected ? 1.0 : 0.6}
      : {color: globalColors.darkBlue2, marginBottom: isSelected ? 0 : 0, opacity: isSelected ? 1.0 : 0.6}
    return <TabBarButton
      source={{type: 'icon', icon}}
      style={{
        ...styleItem,
        borderBottom: `solid 2px ${isSelected ? selectedColor : 'transparent'}`,
        paddingLeft: 0,
      }}
      styleBadge={styleBadge}
      styleIcon={{...styleIcon, ...iconStyle}}
      styleLabel={{
        color: isPublic
          ? (isSelected ? globalColors.black_75 : globalColors.white_75)
          : (isSelected ? globalColors.white : globalColors.black_75),
        fontSize: 14,
      }}
      styleBadgeNumber={styleBadgeNumber}
      selected={isSelected}
      label={isPublic ? 'public/' : 'private/'}
      badgeNumber={isPublic ? this.props.publicBadge : this.props.privateBadge}
    />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    const sharedListProps = {
      style: this.props.listStyle,
      smallMode: this.props.smallMode,
      onRekey: this.props.onRekey,
      onOpen: this.props.onOpen,
      onClick: this.props.onClick,
    }

    return (
      <Box style={{...stylesContainer, backgroundColor: this.props.showingPrivate ? globalColors.darkBlue3 : globalColors.lightGrey, paddingTop: 0, minHeight: 32}}>
        <TabBar styleTabBar={{...tabBarStyle, backgroundColor: this.props.showingPrivate ? globalColors.darkBlue : globalColors.white, minHeight: this.props.smallMode ? 32 : 64, paddingTop: this.props.smallMode ? 0 : 32}}>
          {
            [false, true].map(isPublic => (
              <TabBarItem
                key={isPublic ? 'public' : 'private'}
                selected={this.props.showingPrivate !== isPublic}
                styleContainer={itemContainerStyle}
                tabBarButton={this._makeItem(isPublic, this.props.showingPrivate !== isPublic)}
                onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab(!isPublic) }}>
                <List
                  {...(isPublic ? this.props.public : this.props.private)}
                  {...sharedListProps}
                  isPublic={isPublic}
                  showIgnored={isPublic ? this.props.publicShowingIgnored : this.props.privateShowingIgnored}
                  onToggleShowIgnored={() => this.props.onToggleShowIgnored(!isPublic)} />
              </TabBarItem>
            ))}
        </TabBar>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
}

const styleBadge = {
  borderWidth: 0,
  paddingLeft: 3,
  paddingRight: 3,
  minWidth: 13,
  minHeight: 13,
  borderRadius: 20,
  flex: 'initial',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 15,
  marginLeft: 2,
}

const styleIcon = {
  marginBottom: 2,
}

const styleItem = {
  ...globalStyles.flexBoxRow,
  paddingTop: 8,
  paddingBottom: 8,
  justifyContent: 'center',
  backgroundColor: globalColors.transparent,
}

const styleBadgeNumber = {
  lineHeight: '12px',
  fontSize: 10,
}

const itemContainerStyle = {
  ...globalStyles.flexBoxColumn,
  minWidth: 110,
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 32,
  flexShrink: 1,
}

export default Render
