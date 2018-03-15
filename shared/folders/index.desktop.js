// @flow
import Banner from './install/banner'
import InstallSecurityPrefs from './install/security-prefs.desktop'
import List from './list'
import React, {Component} from 'react'
import {Box, TabBar} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {isLinux} from '../constants/platform'
import {type Props, type FolderType} from '.'

// NOTE: This component is also used in menu-bar (widget)
// Make sure to check behavior there if you're changing this
class FoldersRender extends Component<Props> {
  _makeItem(folderType: FolderType, isSelected: boolean) {
    let isPublic = folderType === 'public'
    const icon = isPublic ? 'iconfont-folder-public' : 'iconfont-folder-private'
    const selectedColor = isPublic ? globalColors.yellowGreen : globalColors.darkBlue2
    const iconStyle = isPublic
      ? {color: globalColors.yellowGreen2, marginBottom: isSelected ? 0 : 0, opacity: isSelected ? 1.0 : 0.6}
      : {color: globalColors.darkBlue2, marginBottom: isSelected ? 0 : 0, opacity: isSelected ? 1.0 : 0.6}
    const badgeNumber = this.props[folderType + 'Badge']
    return (
      <TabBarButton
        source={{type: 'icon', icon}}
        style={{
          ...styleItem,
          borderBottom: `solid 2px ${isSelected ? selectedColor : 'transparent'}`,
          paddingLeft: 0,
          width: 106 + 2 / 3,
        }}
        styleBadge={styleBadge}
        styleBadgeContainer={{position: 'absolute', right: -1 * globalMargins.tiny}}
        styleIcon={{...styleIcon, ...iconStyle}}
        styleLabel={{
          color: isPublic ? globalColors.yellowGreen2 : globalColors.darkBlue,
          opacity: isSelected ? 1 : 0.6,
          fontSize: 12,
        }}
        selected={isSelected}
        label={`${folderType}/`}
        badgeNumber={badgeNumber}
      />
    )
  }

  render() {
    if (this.props.showSecurityPrefs) {
      return <InstallSecurityPrefs />
    }

    const sharedListProps = {
      style: this.props.listStyle,
      smallMode: this.props.smallMode,
      onRekey: this.props.onRekey,
      onOpen: this.props.onOpen,
      onChat: this.props.onChat,
      onClick: this.props.onClick,
      installed: this.props.installed,
    }

    return (
      <Box
        style={{
          ...stylesContainer,
          backgroundColor: globalColors.white,
          paddingTop: 0,
          minHeight: 32,
        }}
      >
        {!this.props.smallMode && !isLinux && <Banner />}
        <TabBar
          styleTabBar={{
            ...tabBarStyle,
            backgroundColor: globalColors.white,
            opacity: !this.props.smallMode && !this.props.installed ? 0.4 : 1,
            minHeight: this.props.smallMode ? 32 : 48,
          }}
          style={{
            flex: 1,
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
                {...sharedListProps}
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
  flexGrow: 1,
}

const styleBadge = {
  marginRight: 2,
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

const itemContainerStyle = {
  ...globalStyles.flexBoxColumn,
  marginBottom: -1,
}

const tabBarStyle = {
  ...globalStyles.flexBoxRow,
}

export default FoldersRender
