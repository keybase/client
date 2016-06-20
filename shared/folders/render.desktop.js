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
    const icon = isPublic ? 'subnav-folders-public' : 'subnav-folders-private'
    const selectedColor = isPublic ? globalColors.yellowGreen : globalColors.darkBlue2
    return <TabBarButton
      source={{type: 'icon', icon}}
      style={{
        ...styleItem,
        borderBottom: `solid 2px ${isSelected ? selectedColor : 'transparent'}`,
      }}
      styleBadge={styleBadge}
      styleIcon={styleIcon}
      styleLabel={{
        color: isPublic
          ? (isSelected ? globalColors.black : globalColors.white_75)
          : (isSelected ? globalColors.white : globalColors.black_75),
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

    return (
      <Box style={{...stylesContainer, backgroundColor: this.props.showingPrivate ? globalColors.darkBlue : globalColors.white, paddingTop: this.props.smallMode ? 0 : 45}}>
        <TabBar styleTabBar={tabBarStyle}>
          <TabBarItem
            selected={this.props.showingPrivate}
            styleContainer={itemContainerStyle}
            tabBarButton={this._makeItem(false, this.props.showingPrivate === true)}
            onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab(true) }}>
            <List
              {...this.props.private}
              style={this.props.listStyle}
              smallMode={this.props.smallMode}
              onRekey={this.props.onRekey}
              onOpen={this.props.onOpen}
              onClick={this.props.onClick} />
          </TabBarItem>
          <TabBarItem
            selected={!this.props.showingPrivate}
            styleContainer={itemContainerStyle}
            tabBarButton={this._makeItem(true, this.props.showingPrivate === false)}
            onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab(false) }}>
            <List
              {...this.props.public}
              style={this.props.listStyle}
              smallMode={this.props.smallMode}
              onRekey={this.props.onRekey}
              onOpen={this.props.onOpen}
              onClick={this.props.onClick} />
          </TabBarItem>
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
  width: 'initial',
  height: 'initial',
}

const styleItem = {
  ...globalStyles.flexBoxRow,
  paddingTop: 8,
  paddingBottom: 8,
  backgroundColor: globalColors.transparent,
}

const styleBadgeNumber = {
  lineHeight: '12px',
  fontSize: 10,
}

const itemContainerStyle = {
  ...globalStyles.flexBoxColumn,
  minWidth: 127,
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 32,
}

export default Render
