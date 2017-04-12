// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import Text from './text'
import {globalStyles, globalColors} from '../styles'
import {StyleSheet} from 'react-native'

class TabBarItem extends Component<void, ItemProps, void> {
  render () {
    return this.props.children
  }
}

class SimpleTabBarButton extends Component<void, ItemProps, void> {
  render () {
    const selectedColor = this.props.selectedColor || globalColors.blue
    return (
      <Box style={{...stylesTab, ...this.props.style}}>
        <Text type='BodySemibold' style={{...stylesLabel, color: this.props.selected ? globalColors.black_75 : globalColors.black_60}}>
          {!!this.props.label && this.props.label.toUpperCase()}
        </Text>
        {this.props.selected && <Box style={stylesSelectedUnderline(selectedColor)} />}
      </Box>
    )
  }
}

class TabBarButton extends Component<void, TabBarButtonProps, void> {
  render () {
    const backgroundColor = this.props.selected ? globalColors.darkBlue4 : globalColors.midnightBlue
    const badgeNumber = this.props.badgeNumber || 0

    const content = (
      <Box style={{backgroundColor, ...stylesTabBarButtonIcon, ...this.props.style, flexGrow: 1}}>
        {this.props.source.type === 'icon'
          ? <Icon type={this.props.source.icon} style={{fontSize: 32, width: 32, textAlign: 'center', color: this.props.selected ? globalColors.blue3 : globalColors.blue3_40, ...this.props.styleIcon}} />
          : this.props.source.avatar}
        {!!this.props.label && <Text type='BodySemibold' style={{textAlign: 'center', ...this.props.styleLabel}}>{this.props.label}</Text>}
        {badgeNumber > 0 &&
          <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 5}} />
          }
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
  _labels (): Array<React$Element<*>> {
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

  _content (): any {
    return (this.props.children || []).find(i => i.props.selected)
  }

  render () {
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
  fontSize: 14,
  lineHeight: 20,
  marginTop: 11,
  marginBottom: 11,
}

const stylesSelectedUnderline = color => ({
  height: 3,
  alignSelf: 'stretch',
  backgroundColor: color,
})

const stylesUnderline = {
  height: StyleSheet.hairlineWidth,
  alignSelf: 'stretch',
  backgroundColor: globalColors.black_05,
}

export {
  TabBarItem,
  TabBarButton,
}

export default TabBar
