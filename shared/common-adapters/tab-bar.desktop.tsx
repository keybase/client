import * as React from 'react'
import Box from './box'
import Icon from './icon'
import Meta from './meta'
import Text from './text'
import Avatar from './avatar'
import Badge from './badge'
import {get} from 'lodash-es'
import shallowEqual from 'shallowequal'
import {Props, ItemProps, TabBarButtonProps} from './tab-bar'
import * as Styles from '../styles'

const Kb = {
  Avatar,
  Badge,
  Box,
  Icon,
  Meta,
  Text,
}

// TODO this thing does 4 different things. a lot of the main nav logic is in here which isn't used by anything else. Split this apart!

class TabBarItem extends React.Component<ItemProps> {
  render() {
    return this.props.children || null
  }
}

class SimpleTabBarButton extends React.Component<ItemProps> {
  shouldComponentUpdate(nextProps: ItemProps): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'styleContainer', 'children'].includes(key as string)) {
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
      <Kb.Box
        style={{
          ...Styles.desktopStyles.clickable,
          [borderLocation]: `solid 2px ${this.props.selected ? selectedColor : 'transparent'}`,
          padding: '8px 12px',
          ...this.props.style,
        }}
      >
        <Kb.Text
          type="BodySmallSemibold"
          style={Styles.platformStyles({
            common: {
              color: this.props.selected ? Styles.globalColors.black : Styles.globalColors.black_50,
            },
            isElectron: {
              ...Styles.desktopStyles.clickable,
              ...underlineStyle,
            },
          })}
        >
          {this.props.label}
        </Kb.Text>
      </Kb.Box>
    )
  }
}

const HighlightLine = () => (
  <Kb.Box
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
  shouldComponentUpdate(nextProps: TabBarButtonProps): boolean {
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
        ].includes(key as string)
      ) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _renderAvatar(_: string, badgeNumber: number) {
    if (this.props.source.type !== 'avatar') return null // needed to make flow happy
    return (
      <Kb.Box
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
        <Kb.Avatar
          size={32}
          onClick={this.props.onClick}
          username={this.props.source.username}
          loadingColor={Styles.globalColors.blueLighter_40}
        />
        {badgeNumber > 0 && (
          <Kb.Box style={{display: 'flex', width: 0}}>
            <Kb.Box style={styles.badgeAvatar}>
              <Kb.Badge badgeNumber={badgeNumber} badgeStyle={{marginLeft: 0, marginRight: 0}} />
            </Kb.Box>
          </Kb.Box>
        )}
        {!!this.props.label && (
          <Kb.Text
            center={true}
            className="title"
            type="BodyTinySemibold"
            style={{
              ...styles.navText,
              color: undefined,
              marginTop: 3,
              ...Styles.desktopStyles.clickable,
              ...this.props.styleLabel,
            }}
          >
            {this.props.label}
          </Kb.Text>
        )}
      </Kb.Box>
    )
  }

  _renderNav(badgeNumber: number, isNew: boolean) {
    if (this.props.source.type !== 'nav') return null // needed to make flow happy
    return (
      <Kb.Box onClick={this.props.onClick}>
        <style>{navRealCSS}</style>
        <Kb.Box
          style={{...styles.tabBarNavIcon, ...this.props.style}}
          className={'nav-item' + (this.props.selected ? ' selected' : '')}
        >
          {this.props.selected && <HighlightLine />}
          <Kb.Icon
            type={this.props.source.icon}
            style={this.props.styleIcon}
            className="img"
            sizeType="Big"
          />
          {badgeNumber > 0 && (
            <Kb.Box style={styles.badgeNav}>
              <Kb.Badge
                badgeNumber={badgeNumber}
                badgeStyle={{marginLeft: 0, marginRight: Styles.globalMargins.tiny}}
              />
            </Kb.Box>
          )}
          {isNew && (
            <Kb.Box style={styles.badgeNav}>
              <Kb.Meta
                title="new"
                size="Small"
                style={{alignSelf: 'center', marginRight: 4}}
                backgroundColor={Styles.globalColors.blueLight}
              />
            </Kb.Box>
          )}
          {!!this.props.label && (
            <Kb.Text
              type="BodySmallSemibold"
              style={{color: undefined, ...styles.navText, ...this.props.styleLabel}}
              className="title"
            >
              {this.props.label}
            </Kb.Text>
          )}
        </Kb.Box>
      </Kb.Box>
    )
  }

  _renderIcon(color: string, badgeNumber: number) {
    if (this.props.source.type !== 'icon') return null // needed to make flow happy
    const backgroundColor = Styles.globalColors.blueDarker2
    return (
      <Kb.Box
        style={{...styles.tabBarButtonIcon, backgroundColor, ...this.props.style}}
        onClick={this.props.onClick}
      >
        <Kb.Icon
          type={this.props.source.icon}
          style={Styles.collapseStyles([styles.icon, this.props.styleIcon])}
          color={color}
        />
        {!!this.props.label && (
          <Kb.Text
            type="BodySemibold"
            center={true}
            style={{color, ...Styles.desktopStyles.clickable, ...this.props.styleLabel}}
          >
            {this.props.label}
          </Kb.Text>
        )}
        {badgeNumber > 0 && (
          <Kb.Box style={{...styles.badgeIcon, ...this.props.styleBadgeContainer}}>
            <Kb.Badge
              badgeNumber={badgeNumber}
              badgeStyle={this.props.styleBadge}
              badgeNumberStyle={this.props.styleBadgeNumber}
            />
          </Kb.Box>
        )}
      </Kb.Box>
    )
  }

  render() {
    const color = this.props.selected ? Styles.globalColors.white : Styles.globalColors.blueLighter_60
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
  shouldComponentUpdate(nextProps: Props): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'styleTabBar', 'children'].includes(key as string)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _labels(): Array<React.ReactNode> {
    // TODO: Not sure why I have to wrap the child in a box, but otherwise touches won't work
    return React.Children.toArray(this.props.children || []).map((item: {props: ItemProps}, i) => {
      const key = item.props.label || get(item, 'props.tabBarButton.props.label') || i
      return (
        <Kb.Box key={key} style={item.props.styleContainer} onClick={item.props.onClick}>
          {item.props.tabBarButton || <SimpleTabBarButton {...item.props} />}
        </Kb.Box>
      )
    })
  }

  _content(): any {
    return React.Children.toArray(this.props.children || []).find(i => i.props.selected)
  }

  render() {
    const tabBarButtons = (
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxRow,
          borderBottom: `solid 1px ${Styles.globalColors.black_10}`,
          flexShrink: 0,
          ...this.props.styleTabBar,
        }}
      >
        {this._labels()}
      </Kb.Box>
    )
    return (
      <Kb.Box style={{...styles.container, ...this.props.style}}>
        {!this.props.tabBarOnBottom && tabBarButtons}
        {this._content()}
        {this.props.tabBarOnBottom && tabBarButtons}
      </Kb.Box>
    )
  }
}

const navRealCSS = `
  .nav-item .img { color: ${Styles.globalColors.blueDarker}; }
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

const styles = Styles.styleSheetCreate(() => ({
  badgeAvatar: {
    left: 46,
    position: 'absolute',
    top: 4,
  },
  badgeIcon: {
    marginLeft: 'auto',
    marginRight: 8,
  },
  badgeNav: {
    position: 'absolute',
    right: 12,
    top: 4,
  },
  container: Styles.globalStyles.flexBoxColumn,
  icon: Styles.platformStyles({
    common: {
      height: 14,
      lineHeight: 16,
      marginBottom: 2,
      paddingRight: 6,
      textAlign: 'center',
    },
  }),
  navText: {
    fontSize: 11,
    marginTop: 2,
  },
  tabBarButtonIcon: Styles.collapseStyles([
    Styles.globalStyles.flexBoxRow,
    Styles.desktopStyles.clickable,
    {
      alignItems: 'center',
      flex: 1,
      paddingLeft: 20,
      position: 'relative',
    },
  ]),
  tabBarNavIcon: Styles.collapseStyles([
    Styles.globalStyles.flexBoxColumn,
    Styles.desktopStyles.clickable,
    {
      alignItems: 'center',
      flex: 1,
      height: 58,
      justifyContent: 'center',
      position: 'relative',
      width: 80,
    },
  ]),
}))

export {TabBarItem, TabBarButton}
export default TabBar
