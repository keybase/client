// @flow
import React, {Component} from 'react'
import {Box, TabBar} from '../common-adapters'
import {TabBarItem, TabBarButton} from '../common-adapters/tab-bar'
import {globalStyles, globalColors, globalMargins} from '../styles'
import List, {type Props as ListProps} from './list.desktop'

export type FolderType = 'public' | 'private' | 'team'

export type Props = {
  username: string,
  privateBadge?: number,
  private: ListProps,
  publicBadge?: number,
  public: ListProps,
  teamBadge?: number,
  team: ListProps,
  selected: FolderType,
  showingIgnored: boolean,
  onSwitchTab?: (selected: FolderType) => void,
  listStyle?: any,
  onClick?: (path: string) => void,
  onChat?: (tlf: string) => void,
  onOpen?: (path: string) => void,
  onRekey: (path: string) => void,
  onToggleShowIgnored: () => void,
}

class FoldersRender extends Component<Props> {
  _makeItem(folderType: FolderType, isSelected: boolean) {
    let isPublic = folderType === 'public'
    const icon = isPublic ? 'iconfont-folder-public' : 'iconfont-folder-private'
    const selectedColor = isPublic ? globalColors.yellowGreen : globalColors.black_75
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
          color: isPublic ? globalColors.yellowGreen2 : globalColors.black_75,
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
    const sharedListProps = {
      style: this.props.listStyle,
      onRekey: this.props.onRekey,
      onOpen: this.props.onOpen,
      onChat: this.props.onChat,
      onClick: this.props.onClick,
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
        <TabBar
          styleTabBar={{
            ...tabBarStyle,
            backgroundColor: globalColors.white,
            opacity: 1,
            minHeight: 32,
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
