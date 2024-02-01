import * as Styles from '@/styles'
import {TouchableOpacity, Keyboard} from 'react-native'
import Badge from '@/common-adapters/badge'
import Box, {Box2} from '@/common-adapters/box'
import Icon from '@/common-adapters/icon'
import Text from '@/common-adapters/text'
import Meta from '@/common-adapters/meta'
import Divider from '@/common-adapters/divider'
import ScrollView from '@/common-adapters/scroll-view'
import {BottomSheetScrollView} from '@/common-adapters/bottom-sheet'
import ProgressIndicator from '@/common-adapters/progress-indicator'
import {useOnMountOnce} from '@/constants/react'
import type {MenuItem, MenuLayoutProps} from '.'
import {default as SafeAreaView, useSafeAreaInsets} from '@/common-adapters/safe-area-view'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import noop from 'lodash/noop'

const Kb = {
  Badge,
  Box,
  Box2,
  Divider,
  Icon,
  Meta,
  ProgressIndicator,
  SafeAreaView,
  Text,
  useSafeAreaInsets,
}

type MenuRowProps = {
  isHeader?: boolean
  newTag?: boolean
  index: number
  numItems: number
  onHidden?: () => void
  textColor?: Styles.Color
  backgroundColor?: Styles.Color
} & MenuItem

const itemContainerHeight = 40

const MenuRow = (props: MenuRowProps) => (
  <TouchableOpacity
    disabled={props.disabled}
    onPress={() => {
      props.onHidden && !props.unWrapped && props.onHidden() // auto hide after a selection
      props.onClick && !props.unWrapped && props.onClick()
    }}
    style={Styles.collapseStyles([
      styles.itemContainer,
      !props.unWrapped && styles.itemContainerWrapped,
      !!props.subTitle && styles.itemContainerWithSubTitle,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
    ])}
  >
    {props.view || (
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        fullHeight={true}
        gap={props.icon ? 'small' : undefined}
      >
        {props.icon || props.isSelected ? (
          <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center" style={styles.iconContainer}>
            {props.isSelected && (
              <Kb.Icon
                type="iconfont-check"
                color={Styles.globalColors.blue}
                fontSize={16}
                sizeType="Default"
              />
            )}
            {props.icon &&
              !props.isSelected &&
              (props.inProgress ? (
                <Kb.ProgressIndicator />
              ) : (
                <>
                  <Kb.Icon
                    color={props.danger ? Styles.globalColors.redDark : Styles.globalColors.black_60}
                    style={Styles.collapseStyles([{alignSelf: 'center'}, props.iconStyle])}
                    sizeType="Default"
                    type={props.icon}
                  />
                  {props.isBadged && <Kb.Badge badgeStyle={styles.iconBadge} />}
                </>
              ))}
          </Kb.Box2>
        ) : null}
        <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            alignItems="center"
            style={{justifyContent: 'center'}}
          >
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Text type="Body" style={Styles.collapseStyles([styleRowText(props), props.style])}>
                {props.title}
                {props.rightTitle ? (
                  <Kb.Text type="BodyTinySemiboldItalic">{' ' + props.rightTitle}</Kb.Text>
                ) : null}
              </Kb.Text>
              {props.newTag && (
                <Kb.Meta
                  title="New"
                  size="Small"
                  backgroundColor={Styles.globalColors.blue}
                  style={styles.badge}
                />
              )}
              {props.decoration}
            </Kb.Box2>
            {!!props.subTitle && (
              <Kb.Box2 direction="horizontal" fullWidth={true}>
                <Kb.Text type="BodyTiny">{props.subTitle}</Kb.Text>
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    )}
    {!!props.progressIndicator && <Kb.ProgressIndicator style={styles.progressIndicator} />}
  </TouchableOpacity>
)

const MenuLayout = (props: MenuLayoutProps) => {
  const {isModal} = props
  const menuItemsWithDividers = props.items.filter((x): x is MenuItem | 'Divider' => x !== undefined)
  const beginningDivider = props.items[0] === 'Divider'
  const firstIsUnWrapped = props.items[0] !== 'Divider' && props.items[0]?.unWrapped

  // hide keyboards that are up
  useOnMountOnce(() => {
    Keyboard.dismiss()
  })

  const items = menuItemsWithDividers.map((mi, idx) =>
    mi === 'Divider' ? (
      idx !== 0 && idx !== props.items.length ? (
        <Kb.Divider key={idx} style={styles.dividerInScrolleView} />
      ) : null
    ) : (
      <MenuRow
        key={idx}
        {...mi}
        index={idx}
        numItems={menuItemsWithDividers.length}
        onHidden={props.closeOnClick ? props.onHidden : undefined}
        textColor={props.textColor}
        backgroundColor={props.backgroundColor}
      />
    )
  )

  const close = (
    <>
      <Kb.Divider style={styles.divider} />
      <Kb.Box style={Styles.collapseStyles([styles.menuGroup, props.listStyle])}>
        <MenuRow
          title={props.closeText || 'Close'}
          index={0}
          numItems={1}
          onClick={props.onHidden} // pass in nothing to onHidden so it doesn't trigger it twice
          onHidden={noop}
          textColor={props.textColor}
          backgroundColor={props.backgroundColor}
        />
      </Kb.Box>
    </>
  )

  const {bottom: safeBottom} = Kb.useSafeAreaInsets()

  if (isModal === 'bottomsheet') {
    return (
      <BottomSheetScrollView style={styles.bottomSheetScrollView}>
        <Kb.Box2
          style={Styles.collapseStyles([styles.bottomSheetContainer, {marginBottom: 20 + safeBottom}])}
          direction="vertical"
          fullWidth={true}
        >
          {props.header}
          {items}
          {close}
        </Kb.Box2>
      </BottomSheetScrollView>
    )
  }

  return (
    <SafeAreaProvider
      initialMetrics={initialWindowMetrics}
      style={[styles.safeProvider, props.safeProviderStyle]}
      pointerEvents="box-none"
    >
      <Kb.SafeAreaView
        style={Styles.collapseStyles([
          styles.safeArea,
          props.backgroundColor && {backgroundColor: props.backgroundColor},
        ])}
      >
        <Kb.Box
          style={Styles.collapseStyles([
            styles.menuBox,
            firstIsUnWrapped && styles.firstIsUnWrapped,
            props.backgroundColor && {backgroundColor: props.backgroundColor},
          ])}
        >
          {props.header}
          {beginningDivider && <Kb.Divider />}
          <ScrollView
            alwaysBounceVertical={false}
            style={Styles.collapseStyles([styles.scrollView, firstIsUnWrapped && styles.firstIsUnWrapped])}
            contentContainerStyle={styles.menuGroup}
          >
            {items}
          </ScrollView>
          {close}
        </Kb.Box>
      </Kb.SafeAreaView>
    </SafeAreaProvider>
  )
}

const styleRowText = (props: {
  isHeader?: boolean
  danger?: boolean
  disabled?: boolean
  textColor?: Styles.Color
}) => {
  const dangerColor = props.danger ? Styles.globalColors.redDark : Styles.globalColors.black
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
      bottomSheetContainer: {
        backgroundColor: Styles.globalColors.white,
        borderRadius: Styles.borderRadius,
        marginBottom: 20,
      },
      bottomSheetScrollView: {
        backgroundColor: Styles.globalColors.black_05OrBlack,
        padding: 8,
      },
      divider: {marginBottom: Styles.globalMargins.tiny},
      dividerInScrolleView: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      firstIsUnWrapped: {paddingTop: 0},
      flexOne: {flex: 1},
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
      iconContainer: {
        justifyContent: 'center',
        width: 20,
      },
      itemContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        height: itemContainerHeight,
        justifyContent: 'center',
        position: 'relative',
      },
      itemContainerWithSubTitle: {height: itemContainerHeight},
      itemContainerWrapped: {
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      menuBox: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        backgroundColor: Styles.globalColors.white,
        justifyContent: 'flex-end',
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.xsmall,
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
      safeArea: {backgroundColor: Styles.globalColors.white},
      safeProvider: {
        flex: 0,
        justifyContent: 'flex-end',
      },
      scrollView: {
        flexGrow: 1,
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
    }) as const
)

export default MenuLayout
