import * as React from 'react'
import * as Styles from '../../../styles'
import {NativeTouchableOpacity, NativeSafeAreaView} from '../../native-wrappers.native'
import Box, {Box2} from '../../box'
import Text from '../../text'
import Meta from '../../meta'
import Divider from '../../divider'
import ScrollView from '../../scroll-view'
import ProgressIndicator from '../../progress-indicator'
import {isLargeScreen} from '../../../constants/platform'
import {MenuItem, _InnerMenuItem, MenuLayoutProps} from '.'

type MenuRowProps = {
  isHeader?: boolean
  newTag?: boolean | null
  index: number
  numItems: number
  onHidden?: (() => void) | null
  textColor?: Styles.Color
  backgroundColor?: Styles.Color
} & MenuItem

const MenuRow = (props: MenuRowProps) => (
  <NativeTouchableOpacity
    disabled={props.disabled}
    onPress={() => {
      props.onHidden && props.onHidden() // auto hide after a selection
      props.onClick && props.onClick()
    }}
    style={Styles.collapseStyles([
      styles.itemContainer,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
    ])}
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
    {!!props.progressIndicator && <ProgressIndicator style={styles.progressIndicator} />}
  </NativeTouchableOpacity>
)

const MenuLayout = (props: MenuLayoutProps) => {
  const menuItemsNoDividers: MenuItem[] = props.items.filter((x): x is MenuItem =>
    x ? x !== 'Divider' : false
  )
  const beginningDivider = props.items[0] === 'Divider'

  return (
    <NativeSafeAreaView
      style={Styles.collapseStyles([
        styles.safeArea,
        props.backgroundColor && {backgroundColor: props.backgroundColor},
      ])}
    >
      <Box
        style={Styles.collapseStyles([
          styles.menuBox,
          props.backgroundColor && {backgroundColor: props.backgroundColor},
        ])}
      >
        {/* Display header if there is one */}
        {props.header && props.header.view}
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
              onHidden={props.closeOnClick ? props.onHidden : undefined}
              textColor={props.textColor}
              backgroundColor={props.backgroundColor}
            />
          ))}
        </ScrollView>
        <Divider style={styles.divider} />
        <Box style={Styles.collapseStyles([styles.menuGroup, props.listStyle])}>
          <MenuRow
            title={props.closeText || 'Close'}
            index={0}
            numItems={1}
            onClick={props.onHidden} // pass in nothing to onHidden so it doesn't trigger it twice
            onHidden={() => {}}
            textColor={props.textColor}
            backgroundColor={props.backgroundColor}
          />
        </Box>
      </Box>
    </NativeSafeAreaView>
  )
}

const styleRowText = (props: {
  isHeader?: boolean
  danger?: boolean
  disabled?: boolean
  textColor?: Styles.Color
}) => {
  const dangerColor = props.danger ? Styles.globalColors.redDark : Styles.globalColors.blueDark
  const color = props.textColor || props.isHeader ? Styles.globalColors.white : dangerColor
  return {color, ...(props.disabled ? {opacity: 0.6} : {})}
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
        position: 'relative',
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
      progressIndicator: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      safeArea: {
        backgroundColor: Styles.globalColors.white,
      },
    } as const)
)

export default MenuLayout
