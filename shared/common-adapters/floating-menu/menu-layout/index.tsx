import type * as React from 'react'
import type {MenuLayoutProps, MenuItem} from './index.shared'
export type {MenuItem, MenuItems, MenuLayoutProps, _InnerMenuItem} from './index.shared'
import {Box2} from '@/common-adapters/box'
import {ClickableBox} from '@/common-adapters/box'
import Divider from '@/common-adapters/divider'
import Icon from '@/common-adapters/icon'
import IconAuto from '@/common-adapters/icon-auto'
import Text from '@/common-adapters/text'
import Meta from '@/common-adapters/meta'
import Badge from '@/common-adapters/badge'
import ProgressIndicator from '@/common-adapters/progress-indicator'
import SafeAreaView, {useSafeAreaInsets} from '@/common-adapters/safe-area-view'
import ScrollView from '@/common-adapters/scroll-view'
import {TouchableOpacity, Keyboard} from 'react-native'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {useOnMountOnce} from '@/constants/react'
import * as Styles from '@/styles'
import noop from 'lodash/noop'
import './menu-layout.css'

const MenuLayout = (props: MenuLayoutProps) => {
  const {bottom: safeBottom} = useSafeAreaInsets()
  useOnMountOnce(() => {
    if (!isMobile) return
    Keyboard.dismiss()
  })

  if (!isMobile) {
    return <DesktopMenuLayout {...props} />
  }

  return <NativeMenuLayout {...props} safeBottom={safeBottom} />
}

const DesktopMenuLayout = (props: MenuLayoutProps) => {
  const renderDivider = (index: number) => (
    <Divider style={index === 0 ? desktopStyles.dividerFirst : desktopStyles.divider} key={index} />
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
        direction="vertical"
        fullWidth={true}
        relative={true}
        className={hoverClassName}
        style={Styles.collapseStyles([desktopStyles.itemContainer, styleClickable])}
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
              style={Styles.collapseStyles([desktopStyles.itemBodyText, item.style, styleDisabled])}
            >
              {item.title}
            </Text>
            {!!item.icon && item.iconIsVisible && <IconAuto style={desktopStyles.icon} type={item.icon} />}
            {item.newTag && (
              <Meta
                title="New"
                size="Small"
                backgroundColor={Styles.globalColors.blue}
                style={desktopStyles.badge}
              />
            )}
            {item.decoration}
            {item.isBadged && <Badge badgeStyle={Styles.collapseStyles([desktopStyles.badge, desktopStyles.iconBadge])} />}
            {item.isSelected && (
              <Icon
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
            style={Styles.collapseStyles([desktopStyles.itemBodyText, item.style])}
          >
            {item.subTitle}
          </Text>
        )}
        {!!item.progressIndicator && <ProgressIndicator type="Large" style={desktopStyles.progressIndicator} />}
      </ClickableBox>
    )
  }

  const items = props.items.reduce<Array<'Divider' | MenuItem>>((arr, item) => {
    if (item === 'Divider' && arr.length && arr.at(-1) === 'Divider') {
      return arr
    }
    if (item) {
      arr.push(item)
    }
    return arr
  }, [])

  return (
    <ClickableBox
      onClick={event => {
        event?.stopPropagation()
      }}
      direction="vertical"
      alignItems="stretch"
      fullWidth={true}
      style={Styles.collapseStyles([desktopStyles.menuContainer, props.style])}
    >
      {props.header}
      {items.some(item => item !== 'Divider') && (
        <Box2
          direction="vertical"
          fullWidth={true}
          noShrink={true}
          style={Styles.collapseStyles([desktopStyles.menuItemList, props.listStyle])}
        >
          {items.map(
            (item, index): React.ReactNode =>
              item === 'Divider' ? renderDivider(index) : renderMenuItem(item, index)
          )}
        </Box2>
      )}
    </ClickableBox>
  )
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
      if (!props.unWrapped) {
        props.onHidden?.()
        props.onClick?.()
      }
    }}
    style={Styles.collapseStyles([
      nativeStyles.itemContainer,
      !props.unWrapped && nativeStyles.itemContainerWrapped,
      !!props.subTitle && nativeStyles.itemContainerWithSubTitle,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
    ])}
  >
    {props.view || (
      <Box2
        direction="horizontal"
        fullWidth={true}
        fullHeight={true}
        gap={props.icon ? 'small' : undefined}
      >
        {props.icon || props.isSelected ? (
          <Box2 direction="horizontal" fullHeight={true} centerChildren={true} style={nativeStyles.iconContainer}>
            {props.isSelected && (
              <Icon
                type="iconfont-check"
                color={Styles.globalColors.blue}
                fontSize={16}
                sizeType="Default"
              />
            )}
            {props.icon &&
              !props.isSelected &&
              (props.inProgress ? (
                <ProgressIndicator />
              ) : (
                <>
                  <IconAuto
                    color={props.danger ? Styles.globalColors.redDark : Styles.globalColors.black_60}
                    style={Styles.collapseStyles([{alignSelf: 'center'}, props.iconStyle])}
                    sizeType="Default"
                    type={props.icon}
                  />
                  {props.isBadged && <Badge badgeStyle={nativeStyles.iconBadge} />}
                </>
              ))}
          </Box2>
        ) : null}
        <Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
          <Box2 direction="vertical" fullHeight={true} fullWidth={true} centerChildren={true}>
            <Box2 direction="horizontal" fullWidth={true}>
              <Text type="Body" style={Styles.collapseStyles([styleRowText(props), props.style])}>
                {props.title}
                {props.rightTitle ? (
                  <Text type="BodyTinySemiboldItalic">{' ' + props.rightTitle}</Text>
                ) : null}
              </Text>
              {props.newTag && (
                <Meta
                  title="New"
                  size="Small"
                  backgroundColor={Styles.globalColors.blue}
                  style={nativeStyles.badge}
                />
              )}
              {props.decoration}
            </Box2>
            {!!props.subTitle && (
              <Box2 direction="horizontal" fullWidth={true}>
                <Text type="BodyTiny">{props.subTitle}</Text>
              </Box2>
            )}
          </Box2>
        </Box2>
      </Box2>
    )}
    {!!props.progressIndicator && <ProgressIndicator style={nativeStyles.progressIndicator} />}
  </TouchableOpacity>
)

const NativeMenuLayout = (props: MenuLayoutProps & {safeBottom: number}) => {
  const {isModal, safeBottom} = props
  const menuItemsWithDividers = props.items.filter((x): x is MenuItem | 'Divider' => x !== undefined)
  const beginningDivider = props.items[0] === 'Divider'
  const firstIsUnWrapped = props.items[0] !== 'Divider' && props.items[0]?.unWrapped

  const items = menuItemsWithDividers.map((mi, idx) =>
    mi === 'Divider' ? (
      idx !== 0 && idx !== props.items.length ? (
        <Divider key={idx} style={nativeStyles.dividerInScrolleView} />
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
      <Divider style={nativeStyles.divider} />
      <Box2 direction="vertical" fullWidth={true} style={Styles.collapseStyles([nativeStyles.menuGroup, props.listStyle])}>
        <MenuRow
          title={props.closeText || 'Close'}
          index={0}
          numItems={1}
          onClick={props.onHidden}
          onHidden={noop}
          textColor={props.textColor}
          backgroundColor={props.backgroundColor}
        />
      </Box2>
    </>
  )

  if (isModal === 'bottomsheet') {
    // Popup's sheet provides the scroll view; this is just the content
    return (
      <Box2
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([
          {backgroundColor: Styles.undynamicColor(Styles.globalColors.black_05OrBlack)},
          nativeStyles.bottomSheetOuter,
        ])}
      >
        <Box2
          style={Styles.collapseStyles([nativeStyles.bottomSheetContainer, {marginBottom: 20 + safeBottom}])}
          direction="vertical"
          fullWidth={true}
        >
          {props.header}
          {items}
          {close}
        </Box2>
      </Box2>
    )
  }

  return (
    <SafeAreaProvider
      initialMetrics={initialWindowMetrics}
      style={[nativeStyles.safeProvider, props.safeProviderStyle]}
      pointerEvents="box-none"
    >
      <SafeAreaView
        style={Styles.collapseStyles([
          nativeStyles.safeArea,
          props.backgroundColor && {backgroundColor: props.backgroundColor},
        ])}
      >
        <Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([
            nativeStyles.menuBox,
            firstIsUnWrapped && nativeStyles.firstIsUnWrapped,
            props.backgroundColor && {backgroundColor: props.backgroundColor},
          ])}
        >
          {props.header}
          {beginningDivider && <Divider />}
          <ScrollView
            alwaysBounceVertical={false}
            style={Styles.collapseStyles([nativeStyles.scrollView, firstIsUnWrapped && nativeStyles.firstIsUnWrapped])}
            contentContainerStyle={nativeStyles.menuGroup}
          >
            {items}
          </ScrollView>
          {close}
        </Box2>
      </SafeAreaView>
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

const sharedIconBadgeStyle = {
  ...Styles.paddingH(0),
  ...Styles.size(Styles.globalMargins.tiny),
  backgroundColor: Styles.globalColors.blue,
  minWidth: 0,
  position: 'relative',
  right: Styles.globalMargins.xtiny,
} as const

const desktopStyles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        alignSelf: 'center',
        marginLeft: 'auto',
      },
      divider: {
        ...Styles.marginV(8),
      },
      dividerFirst: {
        marginBottom: 8,
      },
      icon: {marginLeft: Styles.globalMargins.xtiny},
      iconBadge: sharedIconBadgeStyle,
      itemBodyText: {color: undefined},
      itemContainer: {
        ...Styles.padding(7, Styles.globalMargins.small),
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
        ...Styles.paddingV(Styles.globalMargins.tiny),
      },
      progressIndicator: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: Styles.globalMargins.xtiny,
      },
    }) as const
)

const nativeStyles = Styles.styleSheetCreate(
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
      bottomSheetOuter: {
        padding: 8,
      },
      divider: {marginBottom: Styles.globalMargins.tiny},
      dividerInScrolleView: {
        ...Styles.marginV(Styles.globalMargins.tiny),
      },
      firstIsUnWrapped: {paddingTop: 0},
      iconBadge: sharedIconBadgeStyle,
      iconContainer: {
        width: 20,
      },
      itemContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        ...Styles.centered(),
        height: itemContainerHeight,
        position: 'relative',
      },
      itemContainerWithSubTitle: {height: itemContainerHeight},
      itemContainerWrapped: {
        ...Styles.paddingH(Styles.globalMargins.small),
      },
      menuBox: {
        backgroundColor: Styles.globalColors.white,
        justifyContent: 'flex-end',
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.xsmall,
      },
      menuGroup: {
        justifyContent: 'flex-end',
      },
      progressIndicator: Styles.globalStyles.fillAbsolute,
      safeArea: {backgroundColor: Styles.globalColors.white},
      safeProvider: {
        flex: 0,
        justifyContent: 'flex-end',
      },
      scrollView: {
        flexGrow: 1,
        ...Styles.marginV(Styles.globalMargins.tiny),
      },
    }) as const
)

export default MenuLayout
