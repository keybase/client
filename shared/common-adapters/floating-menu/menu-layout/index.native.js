// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import {TouchableOpacity, SafeAreaView} from 'react-native'
import Box from '../../box'
import Text from '../../text'
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

class MenuLayout extends React.Component<MenuLayoutProps> {
  render() {
    const menuItemsNoDividers = this.props.items.reduce((arr, mi) => {
      if (mi && mi !== 'Divider') {
        arr.push(mi)
      }
      return arr
    }, [])

    return (
      <Box style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <Box style={Styles.collapseStyles([styles.menuBox, this.props.style])}>
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
        </SafeAreaView>
      </Box>
    )
  }
}

const styleRowText = (props: {isHeader?: boolean, danger?: boolean, disabled?: boolean}) => {
  const dangerColor = props.danger ? Styles.globalColors.red : Styles.globalColors.blue
  const color = props.isHeader ? Styles.globalColors.white : dangerColor
  return {color, ...(props.disabled ? {opacity: 0.6} : {}), textAlign: 'center'}
}

const styles = Styles.styleSheetCreate({
  menuBox: {
    ...Styles.globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
  },
  menuGroup: {
    ...Styles.globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  cancelGroup: {
    ...Styles.globalStyles.flexBoxColumn,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    borderColor: Styles.globalColors.black_10,
    borderTopWidth: 1,
  },
  row: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
  },
  safeArea: {
    backgroundColor: Styles.globalColors.white,
  },
})

export default MenuLayout
