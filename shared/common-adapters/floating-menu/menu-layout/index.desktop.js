// @flow
import React, {Component} from 'react'
import type {MenuLayoutProps, MenuItem} from '.'
import {Box, Text} from '../..'
import {
  globalColors,
  globalMargins,
  globalStyles,
  desktopStyles,
  styleSheetCreate,
  collapseStyles,
  platformStyles,
} from '../../../styles'

// TODO refactor to use Overlay and consolidate some of these files
// popup-menu / relative-popup-hoc / floating-menu
// probably all can go in floating-menu now that everything uses that

class MenuLayout extends Component<MenuLayoutProps> {
  _renderDivider = () => <Box style={styles.divider} />

  _renderMenuItem = (item: MenuItem) => {
    let hoverClassName
    let styleDisabled = {}
    if (!item.disabled) {
      hoverClassName = item.danger ? 'menu-hover-danger' : 'menu-hover'
    } else {
      styleDisabled = {opacity: 0.4}
    }

    const styleClickable = item.disabled ? {} : desktopStyles.clickable

    return (
      <Box
        key={item.title}
        className={hoverClassName}
        style={collapseStyles([styles.itemContainer, styleClickable])}
        onClick={event => {
          item.onClick && item.onClick()
          if (this.props.closeOnClick && this.props.onHidden) {
            this.props.onHidden()
            event.stopPropagation()
          }
        }}
      >
        {item.view ? (
          item.view
        ) : (
          <Text
            className="title"
            type="Body"
            style={collapseStyles([styles.itemBodyText, item.style, styleDisabled])}
          >
            {item.title}
          </Text>
        )}
        {!item.view &&
          item.subTitle && (
            <Text
              className="subtitle"
              key={item.subTitle}
              type="BodySmall"
              style={collapseStyles([styles.itemBodyText, item.style])}
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
      this.props.hoverColor ? this.props.hoverColor : globalColors.blue4
    }; }
    .menu-hover-danger:hover { background-color: ${globalColors.red}; }

    .menu-hover .title { color: ${globalColors.black_75}; }
    .menu-hover-danger .title { color: ${globalColors.red}; }
    .menu-hover-danger:hover .title { color: ${globalColors.white}; }
    .menu-hover-danger .subtitle { color: ${globalColors.black_40}; }
    .menu-hover-danger:hover .subtitle { color: ${globalColors.white}; }
    `

    return (
      <Box>
        <style>{realCSS}</style>
        <Box style={collapseStyles([styles.menuContainer, this.props.style])}>
          {/* Display header if there is one */}
          {this.props.header && this.props.header.view}
          {/* Display menu items */}
          {this.props.items.length > 0 && (
            <Box style={styles.menuItemList}>
              {this.props.items
                .filter(Boolean)
                .map(
                  (item, idx) => (item === 'Divider' ? this._renderDivider() : this._renderMenuItem(item))
                )}
            </Box>
          )}
        </Box>
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  divider: {height: 1, backgroundColor: globalColors.black_05, marginTop: 8, marginBottom: 8},
  menuContainer: platformStyles({
    isElectron: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'stretch',
      backgroundColor: globalColors.white,
      borderRadius: 3,
      boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.2)',
      justifyContent: 'flex-start',
      minWidth: 200,
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  }),
  menuItemList: {
    ...globalStyles.flexBoxColumn,
    flexShrink: 0,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  itemContainer: {
    ...globalStyles.flexBoxColumn,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.xtiny,
  },
  itemBodyText: {
    color: undefined,
  },
})

export default MenuLayout
