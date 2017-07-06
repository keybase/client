// @flow
import React, {Component} from 'react'
import get from 'lodash/get'
import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import {NativeTouchableWithoutFeedback, NativeStyleSheet} from './native-wrappers.native'
import Badge from './badge'
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
          style={{...stylesLabel, color: this.props.selected ? globalColors.black_75 : globalColors.black_60}}
        >
          {!!this.props.label && this.props.label.toUpperCase()}
        </Text>
        <Box style={this.props.selected ? stylesSelectedUnderline(selectedColor) : stylesUnselected} />
      </Box>
    )
  }
}

const TabBarButton = (props: TabBarButtonProps) => {
  const badgeNumber = props.badgeNumber || 0

  let badgeComponent = null
  if (badgeNumber > 0) {
    if (props.badgePosition === 'top-right') {
      badgeComponent = (
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...globalStyles.fillAbsolute,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Badge
            badgeNumber={badgeNumber}
            badgeStyle={{marginRight: -30, marginTop: -20}}
            outlineColor={globalColors.darkBlue2}
          />
        </Box>
      )
    } else {
      badgeComponent = <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 5}} />
    }
  }

  const content = (
    <Box style={{...stylesTabBarButtonIcon, ...props.style, flexGrow: 1}}>
      <Icon
        type={props.source.icon}
        style={{
          width: props.isNav ? 40 : 32,
          ...props.styleIcon,
        }}
      />
      {!!props.label &&
        <Text type="BodySemibold" style={{textAlign: 'center', ...props.styleLabel}}>
          {props.label}
        </Text>}
      {badgeComponent}
    </Box>
  )
  if (props.onClick) {
    return (
      <NativeTouchableWithoutFeedback onPress={props.onClick} style={{flex: 1}}>
        {content}
      </NativeTouchableWithoutFeedback>
    )
  }
  return content
}

class TabBar extends Component<void, Props, void> {
  _labels(): Array<React$Element<*>> {
    // TODO: Not sure why I have to wrap the child in a box, but otherwise touches won't work
    return (this.props.children || []).map((item: {props: ItemProps}, i) => {
      const key = item.props.label || get(item, 'props.tabBarButton.props.label') || i
      return (
        <NativeTouchableWithoutFeedback key={key} onPress={item.props.onClick || (() => {})}>
          <Box style={{flex: 1}}>
            <Box style={item.props.styleContainer}>
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
      <Box style={globalStyles.flexBoxColumn}>
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
  alignItems: 'center',
  flexGrow: 1,
  justifyContent: 'center',
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
