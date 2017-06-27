// @flow
import List from './list'
import React, {Component} from 'react'
import type {Props} from './render'
import {Box, TabBar, HeaderHoc} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {compose, defaultProps} from 'recompose'

class FoldersRender extends Component<void, Props, void> {
  _makeItem(isPublic: boolean, isSelected: boolean) {
    const icon = isPublic ? 'icon-folder-public-24' : 'icon-folder-private-24'
    return (
      <TabBarButton
        source={{type: 'icon', icon}}
        style={{
          ...styleItem,
          opacity: isSelected ? 1 : 0.6,
          borderBottomWidth: 2,
          borderBottomColor: isSelected
            ? isPublic ? globalColors.yellowGreen2 : globalColors.darkBlue2
            : globalColors.transparent,
        }}
        styleBadge={styleBadge}
        styleIcon={styleIcon}
        styleLabel={{
          color: isPublic ? globalColors.yellowGreen2 : globalColors.darkBlue,
        }}
        styleBadgeNumber={styleBadgeNumber}
        selected={isSelected}
        label={isPublic ? 'public/' : 'private/'}
        badgeNumber={isPublic ? this.props.publicBadge : this.props.privateBadge}
      />
    )
  }

  render() {
    return (
      <Box
        style={{
          ...stylesContainer,
          backgroundColor: globalColors.white,
        }}
      >
        <Box
          style={{
            backgroundColor: globalColors.white,
          }}
        />
        <TabBar
          styleTabBar={{
            ...tabBarStyle,
            backgroundColor: globalColors.white,
            borderBottomWidth: 1,
            borderBottomColor: globalColors.black_05,
            marginBottom: globalMargins.xtiny,
          }}
        >
          {[false, true].map(isPublic => (
            <TabBarItem
              key={isPublic ? 'public' : 'private'}
              selected={this.props.showingPrivate !== isPublic}
              styleContainer={itemContainerStyle}
              tabBarButton={this._makeItem(isPublic, this.props.showingPrivate !== isPublic)}
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
                onToggleShowIgnored={() => this.props.onToggleShowIgnored(!isPublic)}
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
  marginRight: globalMargins.xtiny,
}

const styleItem = {
  ...globalStyles.flexBoxRow,
  paddingTop: 8,
  paddingBottom: 8,
  backgroundColor: globalColors.transparent,
}

const styleBadgeNumber = {
  lineHeight: '13px',
  fontSize: 11,
}

const itemContainerStyle = {
  ...globalStyles.flexBoxColumn,
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow,
}

export default compose(defaultProps({title: 'FOLDERS', headerStyle: {borderBottomWidth: 0}}), HeaderHoc)(
  FoldersRender
)
