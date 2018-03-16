// @flow
import Box from './box'
import Icon from './icon'
import * as React from 'react'
import Text from './text'
import Badge from './badge'
import Avatar from './avatar'
import get from 'lodash/get'
import shallowEqual from 'shallowequal'
import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import {globalStyles, globalColors, globalMargins, platformStyles, desktopStyles} from '../styles'

// TODO this thing does 4 different things. a lot of the main nav logic is in here which isn't used by anything else. Split this apart!

class TabBarItem extends React.Component<ItemProps> {
  render() {
    return this.props.children
  }
}

class SimpleTabBarButton extends React.Component<ItemProps> {
  shouldComponentUpdate(nextProps: ItemProps, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'styleContainer', 'children'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    const selectedColor = this.props.selectedColor || globalColors.blue
    const borderLocation = this.props.onBottom ? 'borderTop' : 'borderBottom'
    const underlineStyle = this.props.underlined ? {textDecoration: 'underlined'} : {}
    return (
      <Box
        style={{
          ...desktopStyles.clickable,
          [borderLocation]: `solid 2px ${this.props.selected ? selectedColor : 'transparent'}`,
          padding: '8px 12px',
          ...this.props.style,
        }}
      >
        <Text
          type="BodySmallSemibold"
          style={platformStyles({
            common: {
              color: this.props.selected ? globalColors.black_75 : globalColors.black_60,
              fontSize: 11,
            },
            isElectron: {
              ...desktopStyles.clickable,
              ...underlineStyle,
            },
          })}
        >
          {this.props.label}
        </Text>
      </Box>
    )
  }
}

const HighlightLine = () => (
  <Box
    style={{
      ...globalStyles.fillAbsolute,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      backgroundColor: globalColors.white,
      marginTop: globalMargins.xtiny,
      marginBottom: globalMargins.tiny,
      right: undefined,
      width: 2,
    }}
  />
)

class TabBarButton extends React.Component<TabBarButtonProps> {
  shouldComponentUpdate(nextProps: TabBarButtonProps, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (
        [
          'style',
          'styleContainer',
          'styleBadge',
          'styleIcon',
          'styleBadgeNumber',
          'styleLabel',
          'children',
        ].includes(key)
      ) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _renderAvatar(color: string, badgeNumber: number) {
    if (this.props.source.type !== 'avatar') return // needed to make flow happy
    return (
      <Box
        className={'nav-item-avatar' + (this.props.selected ? ' selected' : '')}
        style={platformStyles({
          isElectron: {
            ...globalStyles.flexBoxColumn,
            alignItems: 'center',
            cursor: 'pointer',
            justifyContent: 'center',
            position: 'relative',
            ...this.props.style,
          },
        })}
        onClick={this.props.onClick}
      >
        {this.props.selected && <HighlightLine />}
        <Avatar
          size={24}
          onClick={this.props.onClick}
          username={this.props.source.username}
          loadingColor={globalColors.blue3_40}
          backgroundColor={this.props.selected ? globalColors.white : globalColors.blue3_40}
        />
        {badgeNumber > 0 && (
          <Box style={{width: 0, display: 'flex'}}>
            <Box style={styleBadgeAvatar}>
              <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 0, marginRight: 0}} />
            </Box>
          </Box>
        )}
        {!!this.props.label && (
          <Text
            className="title"
            type="BodySmallSemiboldItalic"
            style={{
              color: undefined,
              fontSize: 11,
              textAlign: 'center',
              ...desktopStyles.clickable,
              ...this.props.styleLabel,
              marginTop: 3,
            }}
          >
            {this.props.label}
          </Text>
        )}
      </Box>
    )
  }

  _renderNav(badgeNumber: number) {
    if (this.props.source.type !== 'nav') return // needed to make flow happy
    return (
      <Box onClick={this.props.onClick}>
        <style>{navRealCSS}</style>
        <Box
          style={{...stylesTabBarNavIcon, ...this.props.style}}
          className={'nav-item' + (this.props.selected ? ' selected' : '')}
        >
          {this.props.selected && <HighlightLine />}
          <Icon type={this.props.source.icon} style={this.props.styleIcon} className="img" />
          {badgeNumber > 0 && (
            <Box style={styleBadgeNav}>
              <Badge
                badgeNumber={badgeNumber}
                badgeStyle={{marginLeft: 0, marginRight: globalMargins.tiny}}
              />
            </Box>
          )}
          {!!this.props.label && (
            <Text
              type="BodySmallSemibold"
              style={{color: undefined, ...stylesNavText, ...this.props.styleLabel}}
              className="title"
            >
              {this.props.label}
            </Text>
          )}
        </Box>
      </Box>
    )
  }

  _renderIcon(color: string, badgeNumber: number) {
    if (this.props.source.type !== 'icon') return // needed to make flow happy
    const backgroundColor = this.props.selected ? globalColors.darkBlue4 : globalColors.darkBlue3
    return (
      <Box
        style={{...stylesTabBarButtonIcon, backgroundColor, ...this.props.style}}
        onClick={this.props.onClick}
      >
        <Icon type={this.props.source.icon} style={{...stylesIcon, color, ...this.props.styleIcon}} />
        {!!this.props.label && (
          <Text
            type="BodySemibold"
            style={{color, textAlign: 'center', ...desktopStyles.clickable, ...this.props.styleLabel}}
          >
            {this.props.label}
          </Text>
        )}
        {badgeNumber > 0 && (
          <Box style={{...styleBadgeIcon, ...this.props.styleBadgeContainer}}>
            <Badge
              badgeNumber={badgeNumber}
              badgeStyle={this.props.styleBadge}
              badgeNumberStyle={this.props.styleBadgeNumber}
            />
          </Box>
        )}
      </Box>
    )
  }

  render() {
    const color = this.props.selected ? globalColors.white : globalColors.blue3_60
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

class TabBar extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'styleTabBar', 'children'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _labels(): Array<React.Node> {
    // TODO: Not sure why I have to wrap the child in a box, but otherwise touches won't work
    // $FlowIssue dunno
    return (this.props.children || []).map((item: {props: ItemProps}, i) => {
      const key = item.props.label || get(item, 'props.tabBarButton.props.label') || i
      return (
        <Box key={key} style={item.props.styleContainer} onClick={item.props.onClick}>
          {item.props.tabBarButton || <SimpleTabBarButton {...item.props} />}
        </Box>
      )
    })
  }

  _content(): any {
    return (this.props.children || []).find(i => i.props.selected)
  }

  render() {
    const tabBarButtons = (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          flexShrink: 0,
          borderBottom: `solid 1px ${globalColors.black_05}`,
          ...this.props.styleTabBar,
        }}
      >
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
  ...desktopStyles.clickable,
  flex: 1,
  alignItems: 'center',
  paddingLeft: 20,
  position: 'relative',
}

const stylesIcon = platformStyles({
  common: {
    height: 14,
    paddingRight: 6,
    lineHeight: 16,
    marginBottom: 2,
    textAlign: 'center',
  },
})

const stylesTabBarNavIcon = {
  ...globalStyles.flexBoxColumn,
  ...desktopStyles.clickable,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  width: 80,
  height: 56,
}

const navRealCSS = `
  .nav-item .img { color: ${globalColors.blue3_60}; }
  .nav-item:hover .img { color: ${globalColors.white}; }
  .nav-item.selected .img { color: ${globalColors.white}; }

  .nav-item .title { color: transparent; }
  .nav-item-avatar .title { color: ${globalColors.blue3_60}; }
  .nav-item.selected .title, .nav-item-avatar.selected .title { color: ${globalColors.white}; }
  .nav-item:hover .title, .nav-item-avatar:hover .title { color: ${globalColors.white}; opacity: 1.0; }
  .nav-item:hover.selected .title, .nav-item-avatar:hover.selected .title { color: ${
    globalColors.white
  }; opacity: 1.0;}
`

const stylesNavText = {
  fontSize: 10,
  marginTop: 0,
}

const styleBadgeAvatar = {
  position: 'absolute',
  left: 46,
  top: 4,
}

const styleBadgeNav = {
  position: 'absolute',
  left: 46,
  top: 5,
}

const styleBadgeIcon = {
  marginLeft: 'auto',
  marginRight: 8,
}

export {TabBarItem, TabBarButton}
export default TabBar
