import * as React from 'react'
import {get} from 'lodash-es'
import {Props, ItemProps, TabBarButtonProps} from './tab-bar'
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
          style={{...stylesLabel, color: this.props.selected ? globalColors.black : globalColors.black_50}}
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
      backgroundColor: globalColors.white,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      bottom: 0,
      height: 2,
      left: 24,
      position: 'absolute',
      right: 24,
    }}
  />
)

const TabBarButton = (props: TabBarButtonProps) => {
  const badgeNumber = props.badgeNumber || 0

  let badgeComponent: React.ReactNode = null
  if (props.badgeNumber) {
    if (props.badgePosition === 'top-right') {
      badgeComponent = (
        <Badge badgeNumber={props.badgeNumber} badgeStyle={{left: '52%', position: 'absolute', top: 2}} />
      )
    } else {
      badgeComponent = <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 5}} />
    }
  }

  const content = (
    <Box style={{...stylesTabBarButtonIcon, ...props.style, flexGrow: 1}}>
      <Icon
        type={
          // @ts-ignore
          props.source.icon
        }
        style={{
          width: props.isNav ? undefined : 32,
          ...props.styleIcon,
        }}
        sizeType="Big"
      />
      {!!props.label && (
        <Text center={true} type="BodySemibold" style={{...props.styleLabel}}>
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
            backgroundColor={globalColors.blueLight}
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
  _labels(): Array<React.ReactNode> {
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
    return React.Children.toArray(this.props.children || []).find(i => i.props.selected)
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
  height: globalMargins.small,
  marginBottom: 11,
  marginTop: 11,
}

const stylesSelectedUnderline = color => ({
  alignSelf: 'stretch',
  backgroundColor: color,
  height: 3,
  marginBottom: -1,
})

const stylesUnselected = {
  height: 2,
}

const stylesUnderline = {
  alignSelf: 'stretch',
  backgroundColor: globalColors.black_10,
  height: NativeStyleSheet.hairlineWidth,
}

export {TabBarItem, TabBarButton}

export default TabBar
