import React, {Component} from 'react'
import {MenuLayoutProps, MenuItem} from '.'
import Box from '../../box'
import Divider from '../../divider'
import Text from '../../text'
import Meta from '../../meta'
import * as Styles from '../../../styles'

class MenuLayout extends Component<MenuLayoutProps> {
  private renderDivider = (index: number) => <Divider style={styles.divider} key={index} />

  private renderMenuItem = (item: MenuItem, index: number) => {
    let hoverClassName
    let styleDisabled = {}
    if (!item.disabled) {
      hoverClassName = item.danger ? 'menu-hover-danger' : 'menu-hover'
    } else {
      styleDisabled = {opacity: 0.4}
    }

    const styleClickable = item.disabled ? {} : Styles.desktopStyles.clickable

    return (
      <Box
        key={index}
        className={hoverClassName}
        style={Styles.collapseStyles([styles.itemContainer, styleClickable])}
        onClick={() => {
          item.onClick && item.onClick()
          if (this.props.closeOnClick && this.props.onHidden) {
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
            {item.newTag && (
              <Meta
                title="New"
                size="Small"
                backgroundColor={Styles.globalColors.blue}
                style={styles.badge}
              />
            )}
            {item.decoration}
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
      </Box>
    )
  }

  render() {
    const realCSS = `
    .menu-hover:hover { background-color: ${
      this.props.hoverColor ? this.props.hoverColor : Styles.globalColors.blueLighter2
    }; }
    .menu-hover-danger:hover { background-color: ${Styles.globalColors.red}; }

    .menu-hover .title { color: ${Styles.globalColors.black}; }
    .menu-hover-danger .title { color: ${Styles.globalColors.red}; }
    .menu-hover-danger:hover .title { color: ${Styles.globalColors.white}; }
    .menu-hover-danger .subtitle { color: ${Styles.globalColors.black_50}; }
    .menu-hover-danger:hover .subtitle { color: ${Styles.globalColors.white}; }
    `

    return (
      <Box
        onClick={event => {
          // never allow a click to go through
          event.stopPropagation()
        }}
      >
        <style>{realCSS}</style>
        <Box style={Styles.collapseStyles([styles.menuContainer, this.props.style])}>
          {/* Display header if there is one */}
          {this.props.header && this.props.header.view}
          {/* Display menu items */}
          {this.props.items.length > 0 && (
            <Box style={Styles.collapseStyles([styles.menuItemList, this.props.listStyle])}>
              {this.props.items
                .reduce<Array<'Divider' | MenuItem>>((arr, item) => {
                  item && arr.push(item)
                  return arr
                }, [])
                .map((item, index) =>
                  item === 'Divider' ? this.renderDivider(index) : this.renderMenuItem(item, index)
                )}
            </Box>
          )}
        </Box>
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  badge: {
    alignSelf: 'center',
    marginLeft: 'auto',
  },
  divider: {
    marginBottom: 8,
    marginTop: 8,
  },
  horizBox: {...Styles.globalStyles.flexBoxRow},
  itemBodyText: {color: undefined},
  itemContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.xtiny,
  },
  menuContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
      backgroundColor: Styles.globalColors.white,
      borderRadius: 3,
      justifyContent: 'flex-start',
      minWidth: 200,
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  }),
  menuItemList: {
    ...Styles.globalStyles.flexBoxColumn,
    flexShrink: 0,
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
}))

export default MenuLayout
