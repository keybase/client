import * as React from 'react'
import type {MenuLayoutProps, MenuItem} from '.'
import Box from '@/common-adapters/box'
import Divider from '@/common-adapters/divider'
import Icon from '@/common-adapters/icon'
import Text from '@/common-adapters/text'
import Meta from '@/common-adapters/meta'
import Badge from '@/common-adapters/badge'
import ProgressIndicator from '@/common-adapters/progress-indicator'
import * as Styles from '@/styles'
import './menu-layout.css'

class MenuLayout extends React.Component<MenuLayoutProps> {
  private renderDivider = (index: number) => (
    <Divider style={index === 0 ? styles.dividerFirst : styles.divider} key={index} />
  )

  private renderMenuItem = (item: MenuItem, index: number) => {
    let hoverClassName: string | undefined
    let styleDisabled: Styles.StylesCrossPlatform = {}
    if (!item.disabled) {
      hoverClassName = item.danger ? 'menu-hover-danger' : 'menu-hover'
    } else {
      styleDisabled = {opacity: 0.4}
    }

    const styleClickable = item.disabled ? {} : Styles.desktopStyles.clickable

    return item.unWrapped ? (
      item.view
    ) : (
      <Box
        key={index}
        className={hoverClassName}
        style={Styles.collapseStyles([styles.itemContainer, styleClickable])}
        onClick={() => {
          item.onClick?.()
          if (this.props.closeOnClick) {
            this.props.onHidden()
          }
        }}
      >
        {item.view}
        {!item.view && (
          <Box style={styles.horizBox}>
            <Text
              className="title"
              type="Body"
              style={Styles.collapseStyles([styles.itemBodyText, item.style, styleDisabled])}
            >
              {item.title}
            </Text>
            {!!item.icon && item.iconIsVisible && <Icon style={styles.icon} type={item.icon} />}
            {item.newTag && (
              <Meta
                title="New"
                size="Small"
                backgroundColor={Styles.globalColors.blue}
                style={styles.badge}
              />
            )}
            {item.decoration}
            {item.isBadged && <Badge badgeStyle={Styles.collapseStyles([styles.badge, styles.iconBadge])} />}
            {item.isSelected && (
              <Icon
                type="iconfont-check"
                color={Styles.globalColors.blue}
                fontSize={16}
                sizeType="Default"
                style={{paddingLeft: Styles.globalMargins.tiny}}
              />
            )}
          </Box>
        )}
        {!item.view && item.subTitle && (
          <Text
            className="subtitle"
            key={item.subTitle}
            type="BodySmall"
            style={Styles.collapseStyles([styles.itemBodyText, item.style])}
          >
            {item.subTitle}
          </Text>
        )}
        {!!item.progressIndicator && <ProgressIndicator type="Large" style={styles.progressIndicator} />}
      </Box>
    )
  }

  render() {
    const items = this.props.items.reduce<Array<'Divider' | MenuItem>>((arr, item) => {
      if (item === 'Divider' && arr.length && arr.at(-1) === 'Divider') {
        return arr
      }
      item && arr.push(item)
      return arr
    }, [])

    return (
      <Box
        onClick={event => {
          // never allow a click to go through
          event.stopPropagation()
        }}
      >
        <Box style={Styles.collapseStyles([styles.menuContainer, this.props.style])}>
          {/* Display header if there is one */}
          {this.props.header}
          {/* Display menu items */}
          {items.some(item => item !== 'Divider') && (
            <Box style={Styles.collapseStyles([styles.menuItemList, this.props.listStyle])}>
              {items.map((item, index) =>
                item === 'Divider' ? this.renderDivider(index) : this.renderMenuItem(item, index)
              )}
            </Box>
          )}
        </Box>
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        alignSelf: 'center',
        marginLeft: 'auto',
      },
      divider: {
        marginBottom: 8,
        marginTop: 8,
      },
      dividerFirst: {
        marginBottom: 8,
      },
      horizBox: {...Styles.globalStyles.flexBoxRow},
      icon: {marginLeft: Styles.globalMargins.xtiny},
      iconBadge: {
        backgroundColor: Styles.globalColors.blue,
        height: Styles.globalMargins.tiny,
        minWidth: 0,
        paddingLeft: 0,
        paddingRight: 0,
        position: 'relative',
        right: Styles.globalMargins.xtiny,
        width: Styles.globalMargins.tiny,
      },
      itemBodyText: {color: undefined},
      itemContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        ...Styles.padding(7, Styles.globalMargins.small),
        position: 'relative',
      },
      menuContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.boxShadow,
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          backgroundColor: Styles.globalColors.white,
          borderRadius: Styles.borderRadius,
          justifyContent: 'flex-start',
          overflowX: 'hidden',
          overflowY: 'auto',
          width: 240,
        },
      }),
      menuItemList: {
        ...Styles.globalStyles.flexBoxColumn,
        flexShrink: 0,
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      progressIndicator: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: Styles.globalMargins.xtiny,
      },
    }) as const
)

export default MenuLayout
