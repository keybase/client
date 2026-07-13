import * as React from 'react'
import * as Kb from '@/common-adapters'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceIdToLongLabel, serviceIdToBadge} from './shared'
import difference from 'lodash/difference'
import {ScrollView} from 'react-native'
import type * as T from '@/constants/types'

type IconProps = {
  service: T.TB.ServiceIdWithContact
  label: Array<string>
  onClick: (s: T.TB.ServiceIdWithContact) => void
  isActive: boolean
  minimalBorder?: boolean
  offset?: SharedValue<number>
}

type Props = {
  services: Array<T.TB.ServiceIdWithContact>
  selectedService: T.TB.ServiceIdWithContact
  onChangeService: (newService: T.TB.ServiceIdWithContact) => void
  servicesShown?: number
  minimalBorder?: boolean
  offset?: SharedValue<number>
}
import {useColorScheme} from 'react-native'
import {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withSpring,
  withDelay,
  withTiming,
  Extrapolation,
  type SharedValue,
  createAnimatedComponent,
} from '@/common-adapters/reanimated'

export const labelHeight = 34

// ── Native-only helpers ──────────────────────────────────────────────────────

const serviceMinWidthWhenSmall = (containerWidth: number) => {
  const minWidth = 70
  if (containerWidth <= minWidth) return minWidth
  const p = containerWidth / minWidth
  let n = Math.floor(p) + 0.5
  if (p % 1 < 0.5) n -= 1
  return containerWidth / n
}

const smallWidth = serviceMinWidthWhenSmall(Kb.Styles.dimensionWidth)
const bigWidth = Math.max(smallWidth, 92)
const AnimatedBox2 = createAnimatedComponent(Kb.Box2)
const AnimatedScrollView = createAnimatedComponent(ScrollView)

const TabletBottomBorderExtension = function TabletBottomBorderExtension(props: {
  offset?: SharedValue<number>
}) {
  'use no memo'
  const {offset} = props
  const borderColor = Kb.Styles.undynamicColor(Kb.Styles.globalColors.black_10)
  const animatedStyles = useAnimatedStyle(() => {
    const translateY = offset
      ? interpolate(offset.value, [0, 100], [0, -8], {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        })
      : 0
    return {borderColor, transform: [{translateY}]}
  })
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} relative={true}>
      <AnimatedBox2
        direction="horizontal"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          {borderBottomWidth: 1, bottom: 0, height: 2, position: 'absolute'},
          animatedStyles,
        ])}
      />
    </Kb.Box2>
  )
}

const ServiceIconNative = function ServiceIcon(props: IconProps) {
  'use no memo'
  const {offset, isActive, service, label, onClick} = props
  const isDarkMode = useColorScheme() === 'dark'
  const color = isActive ? serviceIdToAccentColor(service, isDarkMode) : Kb.Styles.globalColors.black

  const animatedWidth = useAnimatedStyle(() => {
    const width = offset
      ? withTiming(
          interpolate(offset.value, [-100, 0, 100], [bigWidth + 5, bigWidth, smallWidth], {
            extrapolateLeft: Extrapolation.CLAMP,
            extrapolateRight: Extrapolation.CLAMP,
          }),
          {duration: 10}
        )
      : 0
    return {width}
  })
  const animatedOpacity = useAnimatedStyle(() => {
    const opacity = offset
      ? interpolate(offset.value, [0, 40], [1, 0], {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        })
      : 0
    return {opacity}
  })
  const animatedTransform = useAnimatedStyle(() => {
    const translateY = offset
      ? interpolate(offset.value, [0, 100], [0, -8], {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        })
      : 0
    return {transform: [{translateY}]}
  })

  return (
    <Kb.ClickableBox onClick={() => onClick(service)} direction="vertical" relative={true}>
      <AnimatedBox2 direction="vertical" style={[nativeStyles.serviceIconContainer, animatedWidth]}>
        <Kb.Box2 direction="vertical" relative={true}>
          {serviceIdToBadge(service) && (
            <Kb.Badge
              border={true}
              height={9}
              containerStyle={nativeStyles.badgeContainerStyle}
              badgeStyle={nativeStyles.badgeStyle}
              leftRightPadding={0}
            />
          )}
          <Kb.Icon fontSize={18} type={serviceIdToIconFont(service)} color={color} />
        </Kb.Box2>
        <AnimatedBox2 direction="vertical" style={[nativeStyles.labelContainer, animatedOpacity]}>
          <Kb.Box2 direction="vertical" style={{height: labelHeight, width: 74}}>
            <Kb.Box2 direction="vertical">
              {label.map((label, i) => (
                <Kb.Text key={i} center={true} type="BodyTiny" style={{color}}>
                  {label}
                </Kb.Text>
              ))}
            </Kb.Box2>
          </Kb.Box2>
        </AnimatedBox2>
      </AnimatedBox2>
      <AnimatedBox2
        direction="horizontal"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          {borderColor: Kb.Styles.undynamicColor(Kb.Styles.globalColors.black_10)},
          isActive ? nativeStyles.activeTabBar : nativeStyles.inactiveTabBar,
          isActive && {backgroundColor: serviceIdToAccentColor(service, isDarkMode)},
          Kb.Styles.platformStyles({isMobile: animatedTransform}),
        ])}
      />
    </Kb.ClickableBox>
  )
}

const ServiceTabBarNative = (props: Props) => {
  'use no memo'
  const {onChangeService, offset, services, selectedService} = props
  const bounceX = useSharedValue(40)

  React.useEffect(() => {
    bounceX.set(0)
  }, [bounceX])

  const animatedStyles = useAnimatedStyle(() => {
    const translateX = withDelay(100, withSpring(bounceX.value, {}))
    const translateY = offset
      ? interpolate(offset.value, [0, 100], [0, 8], {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        })
      : 0
    const height = offset
      ? withTiming(
          interpolate(offset.value, [0, 100], [72, 48], {
            extrapolateLeft: Extrapolation.CLAMP,
            extrapolateRight: Extrapolation.CLAMP,
          }),
          {duration: 10}
        )
      : 0
    return {height, transform: [{translateX}, {translateY}]}
  })

  return (
    <AnimatedScrollView
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={Kb.Styles.collapseStyles([
        {height: '100%'},
        Kb.Styles.isTablet && {width: '100%'},
      ])}
      style={[nativeStyles.scroll, animatedStyles]}
    >
      {services.map(service => (
        <ServiceIconNative
          key={service}
          offset={offset}
          service={service}
          label={serviceIdToLongLabel(service)}
          onClick={onChangeService}
          isActive={selectedService === service}
        />
      ))}
      {Kb.Styles.isTablet ? <TabletBottomBorderExtension offset={offset} /> : null}
    </AnimatedScrollView>
  )
}

// ── Desktop-only helpers ─────────────────────────────────────────────────────

const getDesktopServicesLayout = (
  services: ReadonlyArray<T.TB.ServiceIdWithContact>,
  selectedService: T.TB.ServiceIdWithContact,
  servicesShown: number,
  lastSelectedUnlockedService?: T.TB.ServiceIdWithContact
) => {
  const lockedServices = services.slice(0, servicesShown)
  const selectedServiceIsLocked = services.indexOf(selectedService) < servicesShown
  const frontServices = selectedServiceIsLocked
    ? lastSelectedUnlockedService === undefined
      ? services.slice(0, servicesShown + 1)
      : lockedServices.concat(lastSelectedUnlockedService)
    : lockedServices.concat(selectedService)
  return {frontServices, moreServices: difference(services, frontServices)}
}

const MoreNetworkItem = (props: {service: T.TB.ServiceIdWithContact}) => {
  const isDarkMode = useColorScheme() === 'dark'
  return (
    <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
      <Kb.Icon
        style={desktopStyles.moreNetworkItemIcon}
        color={serviceIdToAccentColor(props.service, isDarkMode)}
        type={serviceIdToIconFont(props.service)}
      />
      <Kb.Text type="Body">{serviceIdToLongLabel(props.service).join(' ')}</Kb.Text>
    </Kb.Box2>
  )
}

const MoreNetworksButton = (props: {
  services: Array<T.TB.ServiceIdWithContact>
  onChangeService: (service: T.TB.ServiceIdWithContact) => void
}) => {
  const {services, onChangeService} = props
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        closeOnSelect={true}
        items={services.map(service => ({
          onClick: () => onChangeService(service),
          title: service,
          view: <MoreNetworkItem service={service} />,
        }))}
        onHidden={hidePopup}
        visible={true}
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.Box2 direction="vertical" fullHeight={true} flex={1} style={desktopStyles.serviceIconFlex}>
        <Kb.Box2
          direction="vertical"
          style={desktopStyles.moreNetworks1}
          fullHeight={true}
          centerChildren={true}
          ref={popupAnchor}
        >
          <Kb.WithTooltip tooltip="More networks" containerStyle={desktopStyles.moreNetworks2}>
            <Kb.ClickableBox
              onClick={showPopup}
              direction="horizontal"
              alignItems="center"
              justifyContent="center"
              fullWidth={true}
              fullHeight={true}
              style={desktopStyles.moreNetworks3}
            >
              <Kb.Text type="BodyBigExtrabold" style={desktopStyles.moreText}>
                •••
              </Kb.Text>
            </Kb.ClickableBox>
          </Kb.WithTooltip>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={desktopStyles.inactiveTabBar} />
      </Kb.Box2>
      {popup}
    </>
  )
}

const ServiceIconDesktop = (props: IconProps) => {
  const [hover, setHover] = React.useState(false)
  const isDarkMode = useColorScheme() === 'dark'
  const {onClick, service} = props
  const color =
    props.isActive || hover ? serviceIdToAccentColor(service, isDarkMode) : Kb.Styles.globalColors.black
  return (
    <Kb.ClickableBox
      onClick={() => onClick(service)}
      onMouseOver={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      direction="vertical"
      flex={1}
      style={desktopStyles.serviceIconFlex}
    >
      <Kb.Box2
        direction="vertical"
        alignItems="center"
        justifyContent="flex-start"
        flex={1}
        style={desktopStyles.serviceIconContainer}
      >
        <Kb.Box2 direction="vertical" relative={true}>
          {serviceIdToBadge(service) && (
            <Kb.Badge
              border={true}
              height={9}
              containerStyle={desktopStyles.badgeContainerStyle}
              badgeStyle={desktopStyles.badgeStyle}
              leftRightPadding={0}
            />
          )}
          <Kb.Box2 direction="vertical" style={desktopStyles.serviceIconBox}>
            <Kb.Icon color={color} fontSize={16} type={serviceIdToIconFont(service)} />
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={desktopStyles.label}>
          {props.label.map((label, i) => (
            <Kb.Text key={i} center={true} type="BodyTiny" style={{color}}>
              {label}
            </Kb.Text>
          ))}
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          props.isActive
            ? desktopStyles.activeTabBar
            : {
                ...desktopStyles.inactiveTabBar,
                ...(props.minimalBorder ? {borderBottomWidth: 0} : undefined),
              },
          props.isActive && {backgroundColor: serviceIdToAccentColor(service, isDarkMode)},
        ])}
      />
    </Kb.ClickableBox>
  )
}

const ServiceTabBarDesktop = (props: Props) => {
  const [lastSelectedUnlockedService, setLastSelectedUnlockedService] = React.useState<
    T.TB.ServiceIdWithContact | undefined
  >()
  const {services, onChangeService: propsOnChangeService, servicesShown: nLocked = 4} = props
  const onChangeService = (service: T.TB.ServiceIdWithContact) => {
    if (services.indexOf(service) >= nLocked && service !== lastSelectedUnlockedService) {
      setLastSelectedUnlockedService(service)
    }
    propsOnChangeService(service)
  }
  const {frontServices, moreServices} = getDesktopServicesLayout(
    services,
    props.selectedService,
    nLocked,
    lastSelectedUnlockedService
  )
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} noShrink={true} style={desktopStyles.tabBarContainer}>
      {frontServices.map(service => (
        <ServiceIconDesktop
          key={service}
          service={service}
          label={serviceIdToLongLabel(service)}
          onClick={onChangeService}
          isActive={props.selectedService === service}
          minimalBorder={props.minimalBorder}
        />
      ))}
      {moreServices.length > 0 && (
        <MoreNetworksButton services={moreServices} onChangeService={onChangeService} />
      )}
    </Kb.Box2>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      activeTabBar: {
        backgroundColor: Kb.Styles.globalColors.blue,
        bottom: 0,
        height: 2,
        position: 'absolute',
        width: '100%',
      },
      badgeContainerStyle: {position: 'absolute', right: -4, top: -2, zIndex: 1},
      badgeStyle: {backgroundColor: Kb.Styles.globalColors.blue},
      inactiveTabBar: {borderBottomWidth: 1, bottom: 0, height: 2, position: 'absolute'},
      labelContainer: {marginTop: Kb.Styles.globalMargins.xtiny, overflow: 'hidden'},
      scroll: {flexGrow: 0, flexShrink: 0, width: '100%'},
      serviceIconContainer: {
        alignSelf: 'center',
        height: '100%',
        paddingTop: Kb.Styles.globalMargins.tiny,
        position: 'relative',
      },
    }) as const
)

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      activeTabBar: {backgroundColor: Kb.Styles.globalColors.blue, height: 2},
      badgeContainerStyle: {position: 'absolute', right: -4, top: 10},
      badgeStyle: {backgroundColor: Kb.Styles.globalColors.blue},
      inactiveTabBar: {height: 2},
      label: {marginTop: Kb.Styles.globalMargins.xtiny, minWidth: 64},
      moreNetworkItemIcon: {marginRight: Kb.Styles.globalMargins.tiny},
      moreNetworks1: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
      moreNetworks2: {
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        justifyContent: 'center',
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
      },
      moreNetworks3: {
        ...Kb.Styles.border(Kb.Styles.globalColors.black_20, 1, Kb.Styles.borderRadius),
        maxHeight: '100%',
        maxWidth: '100%',
      },
      moreText: {color: Kb.Styles.globalColors.black_50},
      serviceIconBox: {marginTop: 14},
      serviceIconContainer: {
        height: 70,
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.xtiny,
        maxWidth: 72,
        minWidth: 40,
      },
      serviceIconFlex: {maxWidth: 90},
      tabBarContainer: {
        ...Kb.Styles.bottomDivider(),
        minHeight: 30,
      },
    }) as const
)

export const ServiceTabBar = isMobile ? ServiceTabBarNative : ServiceTabBarDesktop
export default ServiceTabBar
