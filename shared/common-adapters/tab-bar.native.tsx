import * as React from 'react'
import * as Styles from '../styles'
import {get} from 'lodash-es'
import {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import {NativeTouchableWithoutFeedback, NativeStyleSheet} from './native-wrappers.native'
import Badge from './badge'
import Box from './box'
import Icon from './icon'
import Meta from './meta'
import Text from './text'

const Kb = {
  Badge,
  Box,
  Icon,
  Meta,
  Text,
}

class TabBarItem extends React.Component<ItemProps> {
  render() {
    return this.props.children || null
  }
}

class SimpleTabBarButton extends React.Component<ItemProps> {
  render() {
    const selectedColor = this.props.selectedColor || Styles.globalColors.blue
    return (
      <Kb.Box style={{...stylesTab, ...this.props.style}}>
        <Kb.Text
          type="BodySmallSemibold"
          style={{
            ...stylesLabel,
            color: this.props.selected ? Styles.globalColors.black : Styles.globalColors.black_50,
          }}
        >
          {!!this.props.label && this.props.label.toUpperCase()}
        </Kb.Text>
        <Kb.Box style={this.props.selected ? stylesSelectedUnderline(selectedColor) : stylesUnselected} />
      </Kb.Box>
    )
  }
}

const UnderlineHighlight = () => (
  <Kb.Box
    style={{
      backgroundColor: Styles.globalColors.white,
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
        <Kb.Badge badgeNumber={props.badgeNumber} badgeStyle={{left: '52%', position: 'absolute', top: 2}} />
      )
    } else {
      badgeComponent = <Kb.Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 5}} />
    }
  }

  const content = (
    <Kb.Box style={{...stylesTabBarButtonIcon, ...props.style, flexGrow: 1}}>
      <Kb.Icon
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
        <Kb.Text center={true} type="BodySemibold" style={{...props.styleLabel}}>
          {props.label}
        </Kb.Text>
      )}
      {badgeComponent}
      {props.isNew && (
        <Kb.Box style={styleBadgeNav}>
          <Kb.Meta
            title="new"
            size="Small"
            style={{alignSelf: 'center', marginRight: 4}}
            backgroundColor={Styles.globalColors.blueLight}
          />
        </Kb.Box>
      )}
      {props.underlined && <UnderlineHighlight />}
    </Kb.Box>
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
          <Kb.Box style={{flex: 1}}>
            <Kb.Box style={item.props.styleContainer}>
              {item.props.tabBarButton || <SimpleTabBarButton {...item.props} />}
            </Kb.Box>
          </Kb.Box>
        </NativeTouchableWithoutFeedback>
      )
    })
  }

  _content(): any {
    return React.Children.toArray(this.props.children || []).find(i => i.props.selected)
  }

  render() {
    const tabBarButtons = (
      <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
        <Kb.Box style={{...Styles.globalStyles.flexBoxRow, ...this.props.styleTabBar}}>
          {this._labels()}
        </Kb.Box>
        {this.props.underlined && <Kb.Box style={stylesUnderline} />}
      </Kb.Box>
    )
    return (
      <Kb.Box style={{...stylesContainer, ...this.props.style}}>
        {!this.props.tabBarOnBottom && tabBarButtons}
        {this._content()}
        {this.props.tabBarOnBottom && tabBarButtons}
      </Kb.Box>
    )
  }
}

const styleBadgeNav = {
  position: 'absolute',
  right: 12,
  top: 4,
}

const stylesContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  ...Styles.globalStyles.fullHeight,
}

const stylesTab = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
  justifyContent: 'flex-end',
}

const stylesTabBarButtonIcon = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
  justifyContent: 'center',
  position: 'relative',
}

const stylesLabel = {
  height: Styles.globalMargins.small,
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
  backgroundColor: Styles.globalColors.black_10,
  height: NativeStyleSheet.hairlineWidth,
}

export {TabBarItem, TabBarButton}

export default TabBar
