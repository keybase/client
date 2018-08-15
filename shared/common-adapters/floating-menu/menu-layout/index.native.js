// @flow
import React, {Component} from 'react'
import {TouchableOpacity} from 'react-native'
import {Box, Text} from '../..'
import {globalColors, globalMargins, globalStyles, styleSheetCreate, collapseStyles} from '../../../styles'
import type {MenuItem, MenuLayoutProps} from '.'

type MenuRowProps = {
  ...MenuItem,
  isHeader?: boolean,
  index: number,
  numItems: number,
  onHidden?: ?() => void,
}

const MenuRow = (props: MenuRowProps) => (
  <TouchableOpacity
    disabled={props.disabled}
    onPress={() => {
      props.onHidden && props.onHidden() // auto hide after a selection
      props.onClick && props.onClick()
    }}
    style={styles.row}
  >
    {props.view || (
      <Text type={'BodyBig'} style={styleRowText(props)}>
        {props.title}
      </Text>
    )}
  </TouchableOpacity>
)

class MenuLayout extends Component<MenuLayoutProps> {
  render() {
    const menuItemsNoDividers = this.props.items.reduce((arr, mi) => {
      if (mi && mi !== 'Divider') {
        arr.push(mi)
      }
      return arr
    }, [])

    return (
      <Box style={styles.overlay}>
        <Box style={collapseStyles([styles.menuBox, this.props.style])}>
          {/* Display header if there is one */}
          {this.props.header && this.props.header.view}
          <Box style={styles.menuGroup}>
            {menuItemsNoDividers.map((mi, idx) => (
              <MenuRow
                key={mi.title}
                {...mi}
                index={idx}
                numItems={menuItemsNoDividers.length}
                onHidden={this.props.closeOnClick ? this.props.onHidden : undefined}
              />
            ))}
          </Box>
          <Box style={styles.cancelGroup}>
            <MenuRow
              title="Cancel"
              index={0}
              numItems={1}
              onClick={this.props.onHidden} // pass in nothing to onHidden so it doesn't trigger it twice
              onHidden={() => {}}
            />
          </Box>
        </Box>
      </Box>
    )
  }
}

const styleRowText = (props: {isHeader?: boolean, danger?: boolean, disabled?: boolean}) => {
  const dangerColor = props.danger ? globalColors.red : globalColors.blue
  const color = props.isHeader ? globalColors.white : dangerColor
  return {color, ...(props.disabled ? {opacity: 0.6} : {}), textAlign: 'center'}
}

const styles = styleSheetCreate({
  menuBox: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: globalColors.white,
  },
  menuGroup: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  cancelGroup: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    borderColor: globalColors.black_05,
    borderTopWidth: 1,
  },
  row: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
    backgroundColor: globalColors.white,
    borderColor: globalColors.black_05,
  },
})

export default MenuLayout
