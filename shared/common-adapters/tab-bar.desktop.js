// @flow
import * as React from 'react'
import Box from './box'
import Icon from './icon'
import Meta from './meta'
import Text from './text'
import Avatar from './avatar'
import Badge from './badge'
import {get} from 'lodash-es'
import shallowEqual from 'shallowequal'
import type {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import * as Styles from '../styles'

// TODO this thing does 4 different things. a lot of the main nav logic is in here which isn't used by anything else. Split this apart!

class TabBarItem extends React.Component<ItemProps> {
  render() {
    return this.props.children || null
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
    const selectedColor = this.props.selectedColor || Styles.globalColors.blue
    const borderLocation = this.props.onBottom ? 'borderTop' : 'borderBottom'
    const underlineStyle = this.props.underlined ? {textDecoration: 'underlined'} : {}
    return (
      <Box
        style={{
          ...Styles.desktopStyles.clickable,
          [borderLocation]: `solid 2px ${this.props.selected ? selectedColor : 'transparent'}`,
          padding: '8px 12px',
          ...this.props.style,
        }}
      >
        <Text
          type="BodySmallSemibold"
          style={Styles.platformStyles({
            common: {
              color: this.props.selected ? Styles.globalColors.black_75 : Styles.globalColors.black_60,
            },
            isElectron: {
              ...Styles.desktopStyles.clickable,
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
      ...Styles.globalStyles.fillAbsolute,
      backgroundColor: Styles.globalColors.white,
      borderBottomRightRadius: 4,
      borderTopRightRadius: 4,
      marginBottom: Styles.globalMargins.tiny,
      marginTop: Styles.globalMargins.xtiny,
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
    if (this.props.source.type !== 'avatar') return null // needed to make flow happy
    return (
      <Box
        className={Styles.classNames('nav-item-avatar', {selected: this.props.selected})}
        style={Styles.platformStyles({
          isElectron: {
            ...Styles.globalStyles.flexBoxColumn,
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
          size={32}
          onClick={this.props.onClick}
          username={this.props.source.username}
          loadingColor={Styles.globalColors.blue3_40}
        />
        {badgeNumber > 0 && (
          <Box style={{display: 'flex', width: 0}}>
            <Box style={styleBadgeAvatar}>
              <Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 0, marginRight: 0}} />
            </Box>
          </Box>
        )}
        {!!this.props.label && (
          <Text
            className="title"
            type="BodyTinySemibold"
            style={{
              ...stylesNavText,
              color: undefined,
              marginTop: 3,
              ...Styles.desktopStyles.clickable,
              ...this.props.styleLabel,
              textAlign: 'center',
            }}
          >
            {this.props.label}
          </Text>
        )}
      </Box>
    )
  }

  _renderNav(badgeNumber: number, isNew: boolean) {
    if (this.props.source.type !== 'nav') return null // needed to make flow happy
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
                badgeStyle={{marginLeft: 0, marginRight: Styles.globalMargins.tiny}}
              />
            </Box>
          )}
          {isNew && (
            <Box style={styleBadgeNav}>
              <Meta
                title="new"
                size="Small"
                style={{alignSelf: 'center', marginRight: 4}}
                backgroundColor={Styles.globalColors.blue2}
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
    if (this.props.source.type !== 'icon') return null // needed to make flow happy
    const backgroundColor = Styles.globalColors.darkBlue3
    return (
      <Box
        style={{...stylesTabBarButtonIcon, backgroundColor, ...this.props.style}}
        onClick={this.props.onClick}
      >
        <Icon
          type={this.props.source.icon}
          style={Styles.collapseStyles([stylesIcon, this.props.styleIcon])}
          color={color}
        />
        {!!this.props.label && (
          <Text
            type="BodySemibold"
            style={{color, textAlign: 'center', ...Styles.desktopStyles.clickable, ...this.props.styleLabel}}
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
    const color = this.props.selected ? Styles.globalColors.white : Styles.globalColors.blue3_60
    const badgeNumber = this.props.badgeNumber || 0

    switch (this.props.source.type) {
      case 'avatar':
        return this._renderAvatar(color, badgeNumber)
      case 'nav':
        return this._renderNav(badgeNumber, this.props.isNew)
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
    return React.Children.toArray(this.props.children || []).find(i => i.props.selected)
  }

  render() {
    const tabBarButtons = (
      <Box
        style={{
          ...Styles.globalStyles.flexBoxRow,
          borderBottom: `solid 1px ${Styles.globalColors.black_10}`,
          flexShrink: 0,
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
  ...Styles.globalStyles.flexBoxColumn,
}

const stylesTabBarButtonIcon = {
  ...Styles.globalStyles.flexBoxRow,
  ...Styles.desktopStyles.clickable,
  alignItems: 'center',
  flex: 1,
  paddingLeft: 20,
  position: 'relative',
}

const stylesIcon = Styles.platformStyles({
  common: {
    height: 14,
    lineHeight: 16,
    marginBottom: 2,
    paddingRight: 6,
    textAlign: 'center',
  },
})

const stylesTabBarNavIcon = {
  ...Styles.globalStyles.flexBoxColumn,
  ...Styles.desktopStyles.clickable,
  alignItems: 'center',
  flex: 1,
  height: 56,
  justifyContent: 'center',
  position: 'relative',
  width: 80,
}

const navRealCSS = `
  .nav-item .img { color: ${Styles.globalColors.darkBlue4}; }
  .nav-item:hover .img { color: ${Styles.globalColors.white}; }
  .nav-item.selected .img { color: ${Styles.globalColors.white}; }

  .nav-item .title { color: transparent; }
  .nav-item-avatar .title { color: ${Styles.globalColors.white}; }
  .nav-item.selected .title, .nav-item-avatar.selected .title { color: ${Styles.globalColors.white}; }
  .nav-item:hover .title, .nav-item-avatar:hover .title { color: ${Styles.globalColors.white}; opacity: 1.0; }
  .nav-item:hover.selected .title, .nav-item-avatar:hover.selected .title { color: ${
    Styles.globalColors.white
  }; opacity: 1.0;}
`

const stylesNavText = {
  fontSize: 10,
  marginTop: 0,
}

const styleBadgeAvatar = {
  left: 46,
  position: 'absolute',
  top: 4,
}

const styleBadgeNav = {
  position: 'absolute',
  right: 12,
  top: 4,
}

const styleBadgeIcon = {
  marginLeft: 'auto',
  marginRight: 8,
}

export {TabBarItem, TabBarButton}
export default TabBar
