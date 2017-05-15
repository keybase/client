// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import {NativeTouchableWithoutFeedback, NativeStyleSheet} from './native-wrappers.native'
import Badge from './badge'
import Avatar from './avatar'
import Box from './box'
import Icon from './icon'
import Text from './text'
import {globalStyles, globalColors, globalMargins} from '../styles'

class TabBarItem extends Component<void, ItemProps, void> {
  render() {
    return this.props.children
  }
}

class SimpleTabBarButton extends Component<void, ItemProps, void> {
  render() {
    const selectedColor = this.props.selectedColor || globalColors.blue
    return (
      <Box style={{...stylesTab, ...this.props.style}}>
        <Text
          type="BodySmallSemibold"
          style={{
            ...stylesLabel,
            color: this.props.selected ? globalColors.black_75 : globalColors.black_60,
          }}
        >
          {!!this.props.label && this.props.label.toUpperCase()}
        </Text>
        <Box
          style={this.props.selected ? stylesSelectedUnderline(selectedColor) : stylesUnselected}
        />
      </Box>
    )
  }
}

class TabBarButton extends Component<void, TabBarButtonProps, void> {
  render() {
    const iconColor = this.props.selected ? globalColors.white : globalColors.blue3_40
    const badgeNumber = this.props.badgeNumber || 0

    let badgeComponent
    if (this.props.badgePosition === 'top-right') {
      badgeComponent = (
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <Badge
            badgeNumber={badgeNumber}
            badgeStyle={{marginRight: -30, marginTop: -20}}
            outlineColor={globalColors.midnightBlue}
          />
        </Box>
      )
    } else {
      badgeComponent = <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 5}} />
    }

    const content = (
      <Box style={{...stylesTabBarButtonIcon, ...this.props.style, flexGrow: 1}}>
        {this.props.source.type === 'icon'
          ? <Icon
              type={this.props.source.icon}
              style={{
                color: iconColor,
                fontSize: 32,
                width: 32,
                textAlign: 'center',
                ...this.props.styleIcon,
              }}
            />
          : <Avatar size={24} username={this.props.source.username} borderColor={iconColor} />}
        {!!this.props.label &&
          <Text type="BodySemibold" style={{textAlign: 'center', ...this.props.styleLabel}}>
            {this.props.label}
          </Text>}
        {badgeNumber > 0 && badgeComponent}
      </Box>
    )
    if (this.props.onClick) {
      return (
        <NativeTouchableWithoutFeedback onPress={this.props.onClick}>
          {content}
        </NativeTouchableWithoutFeedback>
      )
    }
    return content
  }
}

class TabBar extends Component<void, Props, void> {
  _labels(): Array<React$Element<*>> {
    // TODO: Not sure why I have to wrap the child in a box, but otherwise touches won't work
    return (this.props.children || []).map((item: {props: ItemProps}, i) => {
      const key = item.props.label || _.get(item, 'props.tabBarButton.props.label') || i
      return (
        <NativeTouchableWithoutFeedback key={key} onPress={item.props.onClick || (() => {})}>
          <Box style={{flex: 1}}>
            <Box style={{...item.props.styleContainer}}>
              {item.props.tabBarButton || <SimpleTabBarButton {...item.props} />}
            </Box>
          </Box>
        </NativeTouchableWithoutFeedback>
      )
    })
  }

  _content(): any {
    return (this.props.children || []).find(i => i.props.selected)
  }

  render() {
    const tabBarButtons = (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, ...this.props.styleTabBar}}>
          {this._labels()}
        </Box>
        {this.props.underlined && <Box style={stylesUnderline} />}
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
  flex: 1,
}

const stylesTab = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'flex-end',
}

const stylesTabBarButtonIcon = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
}

const stylesLabel = {
  marginTop: 11,
  marginBottom: 11,
  height: globalMargins.small,
}

const stylesSelectedUnderline = color => ({
  height: 3,
  marginBottom: -1,
  alignSelf: 'stretch',
  backgroundColor: color,
})

const stylesUnselected = {
  height: 2,
}

const stylesUnderline = {
  height: NativeStyleSheet.hairlineWidth,
  alignSelf: 'stretch',
  backgroundColor: globalColors.black_05,
}

export {TabBarItem, TabBarButton}

export default TabBar
