// @flow
import List from './list'
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, TabBar} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors, statusBarHeight} from '../styles'

class FoldersRender extends Component<void, Props, void> {
  _makeItem(isPublic: boolean, isSelected: boolean) {
    const icon = isPublic ? 'icon-folder-public-24' : 'icon-folder-private-24'
    return (
      <TabBarButton
        source={{type: 'icon', icon}}
        style={{
          ...styleItem,
          borderBottomWidth: 2,
          borderBottomColor: isSelected
            ? isPublic ? globalColors.yellowGreen : globalColors.darkBlue2
            : globalColors.transparent,
        }}
        styleBadge={styleBadge}
        styleIcon={styleIcon}
        styleLabel={{
          color: isPublic
            ? isSelected ? globalColors.black_75 : globalColors.white_75
            : isSelected ? globalColors.white : globalColors.black_60,
        }}
        styleBadgeNumber={styleBadgeNumber}
        selected={isSelected}
        label={isPublic ? 'public/' : 'private/'}
        badgeNumber={
          isPublic ? this.props.publicBadge : this.props.privateBadge
        }
      />
    )
  }

  render() {
    return (
      <Box
        style={{
          ...stylesContainer,
          backgroundColor: this.props.showingPrivate
            ? globalColors.darkBlue3
            : globalColors.lightGrey,
        }}
      >
        <Box
          style={{
            backgroundColor: this.props.showingPrivate
              ? globalColors.darkBlue
              : globalColors.white,
            height: statusBarHeight,
          }}
        />
        <TabBar
          styleTabBar={{
            ...tabBarStyle,
            backgroundColor: this.props.showingPrivate
              ? globalColors.darkBlue
              : globalColors.white,
          }}
        >
          {[false, true].map(isPublic => (
            <TabBarItem
              key={isPublic ? 'public' : 'private'}
              selected={this.props.showingPrivate !== isPublic}
              styleContainer={itemContainerStyle}
              tabBarButton={this._makeItem(
                isPublic,
                this.props.showingPrivate !== isPublic
              )}
              onClick={() => {
                this.props.onSwitchTab && this.props.onSwitchTab(!isPublic)
              }}
            >
              <List
                {...(isPublic ? this.props.public : this.props.private)}
                smallMode={this.props.smallMode}
                onClick={this.props.onClick}
                isPublic={isPublic}
                showIgnored={this.props.showingIgnored}
                onToggleShowIgnored={() =>
                  this.props.onToggleShowIgnored(!isPublic)}
              />
            </TabBarItem>
          ))}
        </TabBar>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const styleBadge = {
  borderWidth: 0,
  paddingLeft: 3,
  paddingRight: 3,
  borderRadius: 20,
  flex: 'initial',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 15,
  marginLeft: 2,
}

const styleIcon = {
  marginRight: 8,
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
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow,
}

export default FoldersRender
