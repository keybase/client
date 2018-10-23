// @flow
import * as React from 'react'
import {get} from 'lodash-es'
import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import {NativeTouchableWithoutFeedback, NativeStyleSheet} from './native-wrappers.native'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import Meta from './meta'
import Text from './text'
import {globalStyles, globalColors, globalMargins} from '../styles'

class TabBarItem extends React.Component<ItemProps> {
  render() {
    return this.props.children || null
  }
}

class SimpleTabBarButton extends React.Component<ItemProps> {
  render() {
    const selectedColor = this.props.selectedColor || globalColors.blue
    return (
      <Box style={{...stylesTab, ...this.props.style}}>
        <Text
          type="BodySmallSemibold"
          style={{...stylesLabel, color: this.props.selected ? globalColors.black_75 : globalColors.black_40}}
        >
          {!!this.props.label && this.props.label.toUpperCase()}
        </Text>
        <Box style={this.props.selected ? stylesSelectedUnderline(selectedColor) : stylesUnselected} />
      </Box>
    )
  }
}

const UnderlineHighlight = () => (
  <Box
    style={{
      position: 'absolute',
      bottom: 0,
      left: 24,
      right: 24,
      height: 2,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      backgroundColor: globalColors.white,
    }}
  />
)

const TabBarButton = (props: TabBarButtonProps) => {
  const badgeNumber = props.badgeNumber || 0

  let badgeComponent = null
  if (props.badgeNumber) {
    if (props.badgePosition === 'top-right') {
      badgeComponent = (
        <Badge badgeNumber={props.badgeNumber} badgeStyle={{position: 'absolute', top: 2, left: '52%'}} />
      )
    } else {
      badgeComponent = <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 5}} />
    }
  }

  const content = (
    <Box style={{...stylesTabBarButtonIcon, ...props.style, flexGrow: 1}}>
      <Icon
        type={
          // $FlowIssue
          props.source.icon
        }
        style={{
          width: props.isNav ? undefined : 32,
          ...props.styleIcon,
        }}
      />
      {!!props.label && (
        <Text type="BodySemibold" style={{textAlign: 'center', ...props.styleLabel}}>
          {props.label}
        </Text>
      )}
      {badgeComponent}
      {props.isNew && (
        <Box style={styleBadgeNav}>
          <Meta
            title="new"
            size="Small"
            style={{alignSelf: 'center', marginRight: 4}}
            backgroundColor={globalColors.blue2}
          />
        </Box>
      )}
      {props.underlined && <UnderlineHighlight />}
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

class TabBar extends React.Component<Props> {
  _labels(): Array<React.Node> {
    // TODO: Not sure why I have to wrap the child in a box, but otherwise touches won't work
    // $FlowIssue dunno
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
        <Box style={{...globalStyles.flexBoxRow, ...this.props.styleTabBar}}>{this._labels()}</Box>
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

const styleBadgeNav = {
  position: 'absolute',
  right: 12,
  top: 4,
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.fullHeight,
}

const stylesTab = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
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
  backgroundColor: globalColors.black_10,
}

export {TabBarItem, TabBarButton}

export default TabBar
