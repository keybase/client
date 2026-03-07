import type * as React from 'react'
import type {MenuLayoutProps, MenuItem} from '.'
import {Box2} from '@/common-adapters/box'
import ClickableBox from '@/common-adapters/clickable-box'
import Divider from '@/common-adapters/divider'
import Icon2 from '@/common-adapters/icon2'
import IconAuto from '@/common-adapters/icon-auto'
import Text from '@/common-adapters/text'
import Meta from '@/common-adapters/meta'
import Badge from '@/common-adapters/badge'
import ProgressIndicator from '@/common-adapters/progress-indicator'
import * as Styles from '@/styles'
import './menu-layout.css'

const MenuLayout = (props: MenuLayoutProps) => {
  const renderDivider = (index: number) => (
    <Divider style={index === 0 ? styles.dividerFirst : styles.divider} key={index} />
  )

  const renderMenuItem = (item: MenuItem, index: number): React.ReactNode => {
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
      <ClickableBox
        key={index}
        className={hoverClassName}
        style={Styles.collapseStyles([styles.itemContainer, styleClickable])}
        onClick={() => {
          item.onClick?.()
          if (props.closeOnClick) {
            props.onHidden()
          }
        }}
      >
        {item.view}
        {!item.view && (
          <Box2 direction="horizontal" fullWidth={true}>
            <Text
              className="title"
              type="Body"
              style={Styles.collapseStyles([styles.itemBodyText, item.style, styleDisabled])}
            >
              {item.title}
            </Text>
            {!!item.icon && item.iconIsVisible && <IconAuto style={styles.icon} type={item.icon} />}
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
              <Icon2
                type="iconfont-check"
                color={Styles.globalColors.blue}
                fontSize={16}
                sizeType="Default"
                style={{paddingLeft: Styles.globalMargins.tiny}}
              />
            )}
          </Box2>
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
      </ClickableBox>
    )
  }

  const items = props.items.reduce<Array<'Divider' | MenuItem>>((arr, item) => {
    if (item === 'Divider' && arr.length && arr.at(-1) === 'Divider') {
      return arr
    }
    item && arr.push(item)
    return arr
  }, [])

  return (
    <ClickableBox
      onClick={event => {
        // never allow a click to go through
        event.stopPropagation()
      }}
    >
      <Box2
        direction="vertical"
        alignItems="stretch"
        fullWidth={true}
        style={Styles.collapseStyles([styles.menuContainer, props.style])}
      >
        {/* Display header if there is one */}
        {props.header}
        {/* Display menu items */}
        {items.some(item => item !== 'Divider') && (
          <Box2
            direction="vertical"
            fullWidth={true}
            style={Styles.collapseStyles([styles.menuItemList, props.listStyle])}
          >
            {items.map(
              (item, index): React.ReactNode =>
                item === 'Divider' ? renderDivider(index) : renderMenuItem(item, index)
            )}
          </Box2>
        )}
      </Box2>
    </ClickableBox>
  )
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
          backgroundColor: Styles.globalColors.white,
          borderRadius: Styles.borderRadius,
          justifyContent: 'flex-start',
          overflowX: 'hidden',
          overflowY: 'auto',
          width: 240,
        },
      }),
      menuItemList: {
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
