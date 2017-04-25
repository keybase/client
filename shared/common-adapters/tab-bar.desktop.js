// @flow
import Box from './box'
import Icon from './icon'
import React, {Component} from 'react'
import Text from './text'
import Badge from './badge'
import Avatar from './avatar'
import _ from 'lodash'
import shallowEqual from 'shallowequal'
import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import {globalStyles, globalColors, globalMargins} from '../styles'

class TabBarItem extends Component<void, ItemProps, void> {
  render () {
    return this.props.children
  }
}

class SimpleTabBarButton extends Component<void, ItemProps, void> {
  shouldComponentUpdate (nextProps: ItemProps, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'styleContainer', 'children'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render () {
    const selectedColor = this.props.selectedColor || globalColors.blue
    const borderLocation = this.props.onBottom ? 'borderTop' : 'borderBottom'
    const underlineStyle = this.props.underlined ? {textDecoration: 'underlined'} : {}
    return (
      <Box
        style={{
          ...globalStyles.clickable,
          [borderLocation]: `solid 2px ${this.props.selected ? selectedColor : 'transparent'}`,
          padding: '8px 12px',
          ...this.props.style,
        }}>
        <Text
          type='BodySmallSemibold'
          style={{
            ...globalStyles.clickable,
            color: this.props.selected ? globalColors.black_75 : globalColors.black_60,
            fontSize: 11,
            ...underlineStyle,
          }}>
          {this.props.label}
        </Text>
      </Box>
    )
  }
}

class TabBarButton extends Component<void, TabBarButtonProps, void> {
  shouldComponentUpdate (nextProps: TabBarButtonProps, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'styleContainer', 'styleBadge', 'styleIcon', 'styleBadgeNumber', 'styleLabel', 'children'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _renderAvatar (color: string, badgeNumber: number) {
    if (this.props.source.type !== 'avatar') return // needed to make flow happy
    return (
      <Box style={{...globalStyles.flexBoxColumn, paddingBottom: 21, paddingTop: 21, ...this.props.style}} onClick={this.props.onClick}>
        <Box style={{...stylesTabBarButtonIcon, paddingLeft: 0, height: undefined, justifyContent: 'center', ...this.props.styleContainer}}>
          <Avatar size={32} onClick={this.props.onClick} username={this.props.source.username} borderColor={this.props.selected ? globalColors.white : globalColors.blue3_40} loadingColor={globalColors.blue3_40} backgroundColor={this.props.selected ? globalColors.white : globalColors.blue3_40} />
          {badgeNumber > 0 &&
            <Box style={{width: 0, display: 'flex'}}>
              <Box style={{...styleBadgeAvatar}}>
                <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 0, marginRight: 0}} outlineColor={globalColors.midnightBlue} />
              </Box>
            </Box>}
        </Box>
        {!!this.props.label &&
          <Text type='BodySmallSemiboldItalic' style={{color, fontSize: 11, textAlign: 'center', ...globalStyles.clickable, ...this.props.styleLabel, marginTop: 3}}>
            {this.props.label}
          </Text>
        }
      </Box>
    )
  }

  _renderNav (badgeNumber: number) {
    if (this.props.source.type !== 'nav') return // needed to make flow happy
    const navIconStyle = this.props.selected ? stylesNavIconSelected : stylesNavIcon
    return (
      <Box onClick={this.props.onClick}>
        <style>{navRealCSS}</style>
        <Box style={{...stylesTabBarNavIcon, ...this.props.style}} className='nav-item'>
          <Icon type={this.props.source.icon} style={{...navIconStyle, ...this.props.styleIcon}} />
          {badgeNumber > 0 &&
            <Box style={{...styleBadgeNav}}>
              <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 0, marginRight: globalMargins.tiny}} outlineColor={globalColors.midnightBlue} />
            </Box>
          }
          {!!this.props.label &&
            <Text type='BodySmall' style={{...stylesNavText, ...this.props.styleLabel}}>
              <span className={'title' + (this.props.selected ? ' selected' : '')}>
                {this.props.label}
              </span>
            </Text>
          }
        </Box>
      </Box>
    )
  }

  _renderIcon (color: string, badgeNumber: number) {
    if (this.props.source.type !== 'icon') return // needed to make flow happy
    const backgroundColor = this.props.selected ? globalColors.darkBlue4 : globalColors.midnightBlue
    return (
      <Box style={{...stylesTabBarButtonIcon, backgroundColor, ...this.props.style}} onClick={this.props.onClick}>
        <Icon type={this.props.source.icon} style={{...stylesIcon, color, ...this.props.styleIcon}} />
        {!!this.props.label &&
          <Text type='BodySemibold' style={{color, textAlign: 'center', ...globalStyles.clickable, ...this.props.styleLabel}}>
            {this.props.label}
          </Text>
        }
        {badgeNumber > 0 &&
          <Box style={{...styleBadgeIcon}}>
            <Badge badgeNumber={badgeNumber} badgeStyle={this.props.styleBadge} badgeNumberStyle={this.props.styleBadgeNumber} />
          </Box>
        }
      </Box>
    )
  }

  render () {
    const color = this.props.selected ? globalColors.white : globalColors.blue3_40
    const badgeNumber = this.props.badgeNumber || 0

    switch (this.props.source.type) {
      case 'avatar':
        return this._renderAvatar(color, badgeNumber)
      case 'nav':
        return this._renderNav(badgeNumber)
      case 'icon':
      default:
        return this._renderIcon(color, badgeNumber)
    }
  }
}

class TabBar extends Component<void, Props, void> {
  shouldComponentUpdate (nextProps: Props, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'styleTabBar', 'children'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _labels (): Array<React$Element<*>> {
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
      <Box style={{...globalStyles.flexBoxRow, flexShrink: 0, borderBottom: `solid 1px ${globalColors.black_05}`, ...this.props.styleTabBar}}>
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
  paddingRight: 6,
  lineHeight: '16px',
  marginBottom: 2,
  textAlign: 'center',
}

const stylesTabBarNavIcon = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  width: 80,
  height: 56,
}

const navRealCSS = `
  .nav-item .title { color: transparent; }
  .nav-item:hover .title { color: ${globalColors.blue3_40}; }
  .nav-item .title.selected { color: ${globalColors.white}; }
`

const stylesNavText = {
  fontSize: 11,
  marginTop: 1,
}

const stylesNavIcon = {
  color: globalColors.blue3_40,
}

const stylesNavIconSelected = {
  color: globalColors.white,
}

const styleBadgeAvatar = {
  position: 'absolute',
  left: 45,
  top: -5,
}

const styleBadgeNav = {
  position: 'absolute',
  left: 45,
  top: 5,
}

const styleBadgeIcon = {
  marginLeft: 'auto',
  marginRight: 8,
}

export {
  TabBarItem,
  TabBarButton,
}
export default TabBar
