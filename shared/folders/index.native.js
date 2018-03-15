// @flow
import List from './list'
import React, {Component} from 'react'
import {Box, TabBar, HeaderHoc} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../styles'
import {compose, defaultProps} from 'recompose'

import type {Props} from '.'

class FoldersRender extends Component<Props> {
  _makeItem(folderType: string, isSelected: boolean) {
    let isPublic = folderType === 'public'
    const icon = isPublic ? 'icon-folder-public-24' : 'icon-folder-private-24'
    const badgeNumber = this.props[folderType + 'Badge']
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
        label={`${folderType}/`}
        badgeNumber={badgeNumber}
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
        <TabBar
          styleTabBar={{
            ...tabBarStyle,
            backgroundColor: globalColors.white,
            borderBottomWidth: 1,
            borderBottomColor: globalColors.black_05,
            marginBottom: globalMargins.xtiny,
          }}
        >
          {['private', 'public', 'team'].map(selected => (
            <TabBarItem
              key={selected}
              selected={this.props.selected === selected}
              styleContainer={itemContainerStyle}
              tabBarButton={this._makeItem(selected, this.props.selected === selected)}
              onClick={() => {
                this.props.onSwitchTab && this.props.onSwitchTab(selected)
              }}
            >
              <List
                {...this.props[selected]}
                smallMode={this.props.smallMode}
                onClick={this.props.onClick}
                type={selected}
                showIgnored={this.props.showingIgnored}
                onToggleShowIgnored={this.props.onToggleShowIgnored}
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
  ...globalStyles.fullHeight,
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

const styleBadgeNumber = platformStyles({
  isMobile: {
    lineHeight: 13,
    fontSize: 11,
  },
})

const itemContainerStyle = {
  ...globalStyles.flexBoxColumn,
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow,
}

export default compose(defaultProps({title: 'FOLDERS', headerStyle: {borderBottomWidth: 0}}), HeaderHoc)(
  FoldersRender
)
