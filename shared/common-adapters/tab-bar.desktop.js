// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import {globalStyles, globalColors} from '../styles/style-guide'
import Box from './box'
import Text from './text'
import Icon from './icon'

import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'

export class TabBarItem extends Component {
  props: ItemProps;

  render () {
    return this.props.children
  }
}

class SimpleTabBarButton extends Component<void, ItemProps, void> {
  render () {
    const selectedColor = this.props.selectedColor || globalColors.blue
    const borderLocation = this.props.onBottom ? 'borderTop' : 'borderBottom'
    const underlineStyle = this.props.underlined ? {textDecoration: 'underlined'} : {}
    return (
      <Box
        style={{
          ...globalStyles.clickable,
          [borderLocation]: `solid 2px ${this.props.selected ? selectedColor : 'transparent'}`,
          padding: '4px 12px',
          ...this.props.style,
        }}>
        <Text
          type='BodySmallSemibold'
          style={{
            ...globalStyles.clickable,
            color: this.props.selected ? globalColors.black_75 : globalColors.black_60,
            fontSize: 13,
            ...underlineStyle,
          }}>
          {this.props.label}
        </Text>
      </Box>
    )
  }
}

export class TabBarButton extends Component<void, TabBarButtonProps, void> {
  _renderAvatar (backgroundColor: string, color: string, badgeNumber: number) {
    if (this.props.source.type !== 'avatar') return // needed to make flow happy
    return (
      <Box style={{...globalStyles.flexBoxColumn, backgroundColor, paddingBottom: 21, paddingTop: 21, ...this.props.style}}>
        <Box style={{...stylesTabBarButtonIcon, paddingLeft: 0, height: undefined, justifyContent: 'center', ...this.props.styleContainer}}>
          {this.props.source.avatar}
          {badgeNumber > 0 &&
            <Box style={{width: 0, display: 'flex'}}>
              <Box style={{...styleBadgeOutline, borderColor: backgroundColor, backgroundColor}}>
                <Box style={{...styleBadge, marginLeft: 0, marginRight: 0}}>
                  <Text style={{flex: 0}} type='BadgeNumber'>{badgeNumber}</Text>
                </Box>
              </Box>
            </Box>}
        </Box>
        {!!this.props.label && <Text type='BodySemiboldItalic' style={{color, textAlign: 'center', ...this.props.styleLabel}}>{this.props.label}</Text>}
      </Box>
    )
  }

  _renderIcon (backgroundColor: string, color: string, badgeNumber: number) {
    if (this.props.source.type !== 'icon') return // needed to make flow happy
    return (
      <Box style={{...stylesTabBarButtonIcon, backgroundColor, ...this.props.style}}>
        <Icon type={this.props.source.icon} style={{...stylesIcon, color, ...this.props.styleIcon}} />
        {!!this.props.label && <Text type={this.props.styleLabelType || 'Body'} style={{color, ...this.props.styleLabel}}>{this.props.label}</Text>}
        {badgeNumber > 0 &&
          <Box style={{...styleBadge, ...this.props.styleBadge}}>
            <Text style={{flex: 0, ...this.props.styleBadgeNumber}} type='BadgeNumber'>{badgeNumber}</Text>
          </Box>}
      </Box>
    )
  }

  render () {
    const backgroundColor = this.props.selected ? globalColors.darkBlue4 : globalColors.midnightBlue
    const color = this.props.selected ? globalColors.white : globalColors.blue3_40
    const badgeNumber = this.props.badgeNumber || 0

    switch (this.props.source.type) {
      case 'avatar':
        return this._renderAvatar(backgroundColor, color, badgeNumber)
      case 'icon':
      default:
        return this._renderIcon(backgroundColor, color, badgeNumber)
    }
  }
}

const styleBadge = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.orange,
  borderColor: globalColors.orange,
  borderWidth: 2,
  paddingLeft: 5,
  paddingRight: 5,
  borderRadius: 10,
  flex: 0,
  marginLeft: 'auto',
  marginRight: 8,
}

const styleBadgeOutline = {
  ...globalStyles.flexBoxRow,
  borderWidth: 2,
  borderRadius: 10,
  borderStyle: 'solid',
  position: 'relative',
  right: 10,
  bottom: 10,
}

class TabBar extends Component {
  props: Props;

  _labels (): Array<React$Element> {
    // TODO: Not sure why I have to wrap the child in a box, but otherwise touches won't work
    return (this.props.children || []).map((item: {props: ItemProps}, i) => {
      const key = item.props.label || _.get(item, 'props.tabBarButton.props.label') || i
      return (
        <Box key={key} style={item.props.styleContainer} onClick={item.props.onClick}>
          {item.props.tabBarButton || <SimpleTabBarButton {...item.props} />}
        </Box>
      )
    })
  }

  _content (): any {
    return (this.props.children || []).find(i => i.props.selected)
  }

  render () {
    const tabBarButtons = (
      <Box style={{...globalStyles.flexBoxRow, flexShrink: 0, ...this.props.styleTabBar}}>
        {this._labels()}
      </Box>
    )

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        {!this.props.tabBarOnBottom && tabBarButtons}
        {this._content()}
        {this.props.tabBarOnBottom && tabBarButtons}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
}

const stylesTabBarButtonIcon = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  flex: 1,
  alignItems: 'center',
  paddingLeft: 20,
  position: 'relative',
}

const stylesIcon = {
  height: 14,
  paddingRight: 9,
  lineHeight: '16px',
  marginBottom: 2,
  textAlign: 'center',
}

export default TabBar
