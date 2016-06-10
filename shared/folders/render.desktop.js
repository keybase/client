// @flow
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, TabBar, ComingSoon} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import List from './list'
import {globalStyles, globalColors} from '../styles/style-guide'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <ComingSoon />
  }

  _makeItem (isPublic: boolean, isSelected: boolean) {
    return <TabBarButton
      source={{type: 'icon', icon: `subnav-folders-${isPublic ? 'public' : 'private'}`}}
      style={{
        ...styleItem,
        borderBottom: isSelected
          ? `solid 2px ${isPublic ? globalColors.yellowGreen : globalColors.darkBlue2}`
          : 'none'
      }}
      styleBadge={styleBadge}
      styleIcon={styleIcon}
      styleLabel={{
        color: isPublic
          ? (isSelected ? globalColors.black : globalColors.white_75)
          : (isSelected ? globalColors.white : globalColors.black_75)
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
      <Box style={{...stylesContainer, backgroundColor: this.props.showingPrivate ? globalColors.darkBlue : globalColors.white}}>
        <TabBar tabBarStyle={tabBarStyle}>
          <TabBarItem
            selected={this.props.showingPrivate}
            containerStyle={itemContainerStyle}
            tabBarButton={this._makeItem(false, this.props.showingPrivate === true)}
            onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab(true) }}>
            <List
              {...this.props.private}
              style={this.props.listStyle}
              smallMode={this.props.smallMode}
              onRekey={this.props.onRekey}
              onClick={this.props.onClick} />
          </TabBarItem>
          <TabBarItem
            selected={!this.props.showingPrivate}
            containerStyle={itemContainerStyle}
            tabBarButton={this._makeItem(true, this.props.showingPrivate === false)}
            onClick={() => { this.props.onSwitchTab && this.props.onSwitchTab(false) }}>
            <List
              {...this.props.public}
              style={this.props.listStyle}
              smallMode={this.props.smallMode}
              onRekey={this.props.onRekey}
              onClick={this.props.onClick} />
          </TabBarItem>
        </TabBar>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1
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
  marginLeft: 2
}

const styleIcon = {
  width: 'initial',
  height: 'initial'
}

const styleItem = {
  ...globalStyles.flexBoxRow,
  paddingTop: 8,
  paddingBottom: 8,
  backgroundColor: globalColors.transparent
}

const styleBadgeNumber = {
  lineHeight: '12px',
  fontSize: 10
}

const itemContainerStyle = {
  ...globalStyles.flexBoxColumn,
  minWidth: 127
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 32
}

export default Render
