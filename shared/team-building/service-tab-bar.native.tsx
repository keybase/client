import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceIdToLongLabel, serviceIdToBadge} from './shared'
import type {ServiceIdWithContact} from '../constants/types/team-building'
import {ScrollView} from 'react-native'
import type {Props, IconProps} from './service-tab-bar'
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
} from '../common-adapters/reanimated'

export const labelHeight = 34

const serviceMinWidthWhenSmall = (containerWidth: number) => {
  const minWidth = 70
  if (containerWidth <= minWidth) {
    return minWidth
  }
  const p = containerWidth / minWidth // count that would fit onscreen at ideal size
  let n = Math.floor(p) + 0.5
  if (p % 1 < 0.5) {
    n -= 1
  }
  // n = count that will fit onscreen at returned size
  return containerWidth / n
}

const smallWidth = serviceMinWidthWhenSmall(Styles.dimensionWidth)
const bigWidth = Math.max(smallWidth, 92)
const AnimatedBox2 = createAnimatedComponent(Kb.Box2)
const AnimatedScrollView = createAnimatedComponent(ScrollView)

// On tablet add an additional "service" item that is only a bottom border that extends to the end of the ScrollView
const TabletBottomBorderExtension = React.memo(
  (props: {offset?: SharedValue<number>; servicesCount: number}) => {
    const {offset} = props
    const animatedStyles = useAnimatedStyle(() => {
      const translateY = offset
        ? interpolate(offset.value, [0, 100], [0, -8], {
            extrapolateLeft: Extrapolation.CLAMP,
            extrapolateRight: Extrapolation.CLAMP,
          })
        : 0
      return {transform: [{translateY}]}
    })

    return (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={{position: 'relative'}}>
        <AnimatedBox2
          direction="horizontal"
          fullWidth={true}
          style={[
            {
              borderBottomWidth: 1,
              borderColor: Styles.globalColors.black_10,
              bottom: 0,
              height: 2,
              position: 'absolute',
            },
            animatedStyles,
          ]}
        />
      </Kb.Box2>
    )
  }
)

const ServiceIcon = React.memo(function ServiceIcon(props: IconProps) {
  const {offset, isActive, service, label, onClick} = props
  const color = isActive ? serviceIdToAccentColor(service) : Styles.globalColors.black

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
    <Kb.ClickableBox onClick={() => onClick(service)} style={{position: 'relative'}}>
      <AnimatedBox2 direction="vertical" style={[styles.serviceIconContainer, animatedWidth]}>
        <Kb.Box2 direction="vertical" style={{position: 'relative'}}>
          {serviceIdToBadge(service) && (
            <Kb.Badge
              border={true}
              height={9}
              containerStyle={styles.badgeContainerStyle}
              badgeStyle={styles.badgeStyle}
              leftRightPadding={0}
            />
          )}
          <Kb.Icon fontSize={18} type={serviceIdToIconFont(service)} color={color} />
        </Kb.Box2>
        <AnimatedBox2 direction="vertical" style={[styles.labelContainer, animatedOpacity]}>
          <Kb.Box2 direction="vertical" style={{height: labelHeight, width: 74}}>
            <Kb.Box2 direction="vertical">
              {label.map((label, i) => (
                <Kb.Text
                  key={i}
                  center={true}
                  type="BodyTiny"
                  // @ts-ignore: we need to allow any color here for various services
                  style={{color}}
                >
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
        style={[
          isActive ? styles.activeTabBar : styles.inactiveTabBar,
          isActive && {backgroundColor: serviceIdToAccentColor(service)},
          animatedTransform,
        ]}
      />
    </Kb.ClickableBox>
  )
})

export const ServiceTabBar = (props: Props) => {
  const {onChangeService, offset, services, selectedService} = props
  const bounceX = useSharedValue(40)
  const onClick = React.useCallback(
    (service: ServiceIdWithContact) => {
      onChangeService(service)
    },
    [onChangeService]
  )

  React.useEffect(() => {
    bounceX.value = 0
  }, [bounceX])

  const animatedStyles = useAnimatedStyle(() => {
    const translateX = withDelay(100, withSpring(bounceX.value, {}))
    const translateY = offset
      ? interpolate(offset.value, [0, 100], [0, 8], {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        })
      : 0

    // withTiming workaround due to https://github.com/software-mansion/react-native-reanimated/issues/1947#issuecomment-942413134
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
      contentContainerStyle={Styles.collapseStyles([{height: '100%'}, Styles.isTablet && {width: '100%'}])}
      style={[styles.scroll, animatedStyles]}
    >
      {services.map(service => (
        <ServiceIcon
          key={service}
          offset={offset}
          service={service}
          label={serviceIdToLongLabel(service)}
          onClick={onClick}
          isActive={selectedService === service}
        />
      ))}
      {Styles.isTablet ? (
        <TabletBottomBorderExtension offset={offset} servicesCount={services.length} />
      ) : null}
    </AnimatedScrollView>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      activeTabBar: {
        backgroundColor: Styles.globalColors.blue,
        bottom: 0,
        height: 2,
        position: 'absolute',
        width: '100%',
      },
      badgeContainerStyle: {
        position: 'absolute',
        right: -4,
        top: -2,
        zIndex: 1, // above the service icon
      },
      badgeStyle: {backgroundColor: Styles.globalColors.blue},
      inactiveTabBar: {
        borderBottomWidth: 1,
        borderColor: Styles.globalColors.black_10,
        bottom: 0,
        height: 2,
        position: 'absolute',
      },
      labelContainer: {
        marginTop: Styles.globalMargins.xtiny,
        overflow: 'hidden',
      },
      pendingAnimation: {height: 17, width: 17},
      scroll: {
        flexGrow: 0,
        flexShrink: 0,
        width: '100%',
      },
      serviceIconContainer: {
        alignSelf: 'center',
        height: '100%',
        paddingTop: Styles.globalMargins.tiny,
        position: 'relative',
      },
      tabBarContainer: {
        backgroundColor: Styles.globalColors.white,
        shadowOffset: {height: 3, width: 0},
        shadowRadius: 2,
      },
    } as const)
)

export default ServiceTabBar
