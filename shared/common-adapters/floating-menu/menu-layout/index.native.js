// @flow
import * as React from 'react'
import * as Styles from '../../../styles'
import {TouchableOpacity, SafeAreaView} from 'react-native'
import Box, {Box2} from '../../box'
import Text from '../../text'
import Meta from '../../meta'
import Divider from '../../divider'
import ScrollView from '../../scroll-view'
import {isLargeScreen} from '../../../constants/platform'
import type {MenuItem, MenuLayoutProps} from '.'

type MenuRowProps = {
  ...MenuItem,
  isHeader?: boolean,
  newTag?: ?boolean,
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
    style={styles.itemContainer}
  >
    {props.view || (
      <>
        <Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
          {props.decoration && <Box style={styles.flexOne} />}
          <Text center={true} type="BodyBig" style={styleRowText(props)}>
            {props.title}
          </Text>
          {props.newTag && (
            <Meta title="New" size="Small" backgroundColor={Styles.globalColors.blue} style={styles.badge} />
          )}
          {props.decoration && <Box style={styles.flexOne}>{props.decoration}</Box>}
        </Box2>
        {!!props.subTitle && (
          <Text center={true} type="BodyTiny">
            {props.subTitle}
          </Text>
        )}
      </>
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
    const beginningDivider = this.props.items[0] === 'Divider'

    return (
      <SafeAreaView style={styles.safeArea}>
        <Box style={Styles.collapseStyles([styles.menuBox, this.props.style])}>
          {/* Display header if there is one */}
          {this.props.header && this.props.header.view}
          {beginningDivider && <Divider style={styles.divider} />}
          <ScrollView
            alwaysBounceVertical={false}
            style={Styles.collapseStyles([
              styles.flexGrow,
              // if we set it to numItems * 56 exactly, the scrollview
              // shrinks by 2px for some reason, which undermines alwaysBounceVertical={false}
              // Add 2px to compensate
              {height: Math.min(menuItemsNoDividers.length * 56 + 2, isLargeScreen ? 500 : 350)},
            ])}
            contentContainerStyle={styles.menuGroup}
          >
            {menuItemsNoDividers.map((mi, idx) => (
              <MenuRow
                key={mi.title}
                {...mi}
                index={idx}
                numItems={menuItemsNoDividers.length}
                onHidden={this.props.closeOnClick ? this.props.onHidden : undefined}
              />
            ))}
          </ScrollView>
          <Divider style={styles.divider} />
          <Box style={styles.menuGroup}>
            <MenuRow
              title={this.props.closeText || 'Close'}
              index={0}
              numItems={1}
              onClick={this.props.onHidden} // pass in nothing to onHidden so it doesn't trigger it twice
              onHidden={() => {}}
            />
          </Box>
        </Box>
      </SafeAreaView>
    )
  }
}

const styleRowText = (props: {isHeader?: boolean, danger?: boolean, disabled?: boolean}) => {
  const dangerColor = props.danger ? Styles.globalColors.red : Styles.globalColors.blue
  const color = props.isHeader ? Styles.globalColors.white : dangerColor
  return {color, ...(props.disabled ? {opacity: 0.6} : {})}
}

const styles = Styles.styleSheetCreate({
  badge: {
    alignSelf: 'center',
    marginLeft: Styles.globalMargins.tiny,
  },
  divider: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
  flexGrow: {
    flexGrow: 1,
  },
  flexOne: {
    flex: 1,
  },
  itemContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    height: 56,
    justifyContent: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.tiny,
  },
  menuBox: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.tiny,
  },
  menuGroup: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  safeArea: {
    backgroundColor: Styles.globalColors.white,
  },
})

export default MenuLayout
