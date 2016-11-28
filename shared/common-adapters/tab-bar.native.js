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
          {this.props.label.toUpperCase()}
        </Text>
        {(!this.props.underlined || this.props.selected) && <Box style={stylesSelectedUnderline(this.props.selected ? selectedColor : 'transparent')} />}
        {!this.props.selected && this.props.underlined && <Box style={stylesUnselectedUnderline} />}
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
          ? <Icon type={this.props.source.icon} style={{fontSize: 48, width: 48, textAlign: 'center', color: this.props.selected ? globalColors.blue3 : globalColors.blue3_40, ...this.props.styleIcon}} />
          : this.props.source.avatar}
        {badgeNumber > 0 &&
          <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}>
            <Badge badgeNumber={badgeNumber} badgeStyle={{marginRight: -40, marginTop: -20}} />
          </Box>}
        {!!this.props.label && <Text type='BodySemibold' style={{textAlign: 'center', ...this.props.styleLabel}}>{this.props.label}</Text>}
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
          <Box style={{...item.props.styleContainer, flexGrow: 1}}>
            {item.props.tabBarButton || <SimpleTabBarButton {...item.props} />}
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
      <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.midnightBlue, ...this.props.styleTabBar}}>
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

const stylesTab = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
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

const stylesUnselectedUnderline = {
  height: 2,
  marginTop: 1,
  backgroundColor: globalColors.black_10,
  alignSelf: 'stretch',
}

export {
  TabBarItem,
  TabBarButton,
}

export default TabBar
