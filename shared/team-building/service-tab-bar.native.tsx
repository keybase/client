import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceIdToLongLabel, serviceIdToBadge} from './shared'
import type {Props, IconProps} from './service-tab-bar'
import {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withSpring,
  withDelay,
  Extrapolation,
} from 'react-native-reanimated'

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
const AnimatedBox2 = Kb.ReAnimated.createAnimatedComponent(Kb.Box2)

// On tablet add an additional "service" item that is only a bottom border that extends to the end of the ScrollView
const TabletBottomBorderExtension = React.memo((props: {offset: number; servicesCount: number}) => {
  const translateY = Kb.ReAnimated.interpolateNode(props.offset, {
    inputRange: [-100, 0, 100, 9999],
    outputRange: [0, 0, -8, -8],
  })

  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={{position: 'relative'}}>
      <AnimatedBox2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([
          {
            borderBottomWidth: 1,
            borderColor: Styles.globalColors.black_10,
            bottom: 0,
            height: 2,
            position: 'absolute',
          },
          {transform: [{translateY}]},
        ] as any)}
      />
    </Kb.Box2>
  )
})

const ServiceIcon = React.memo((props: IconProps) => {
  const {offset, isActive, service, label, onClick} = props
  const color = isActive ? serviceIdToAccentColor(service) : Styles.globalColors.black

  const opacity = 1
  const width = bigWidth
  const translateY = 0

  // const opacity = Kb.ReAnimated.interpolateNode(offset, {
  //   inputRange: [-9999, 0, 40, 9999],
  //   outputRange: [1, 1, 0, 0],
  // })
  // const width = Kb.ReAnimated.interpolateNode(offset, {
  //   inputRange: [-9999, -100, 0, 100, 9999],
  //   outputRange: [bigWidth + 5, bigWidth + 5, bigWidth, smallWidth, smallWidth],
  // })
  // const translateY = Kb.ReAnimated.interpolateNode(offset, {
  //   inputRange: [-100, 0, 100, 9999],
  //   outputRange: [0, 0, -8, -8],
  // })

  return (
    <Kb.ClickableBox onClick={() => onClick(service)} style={{position: 'relative'}}>
      <AnimatedBox2 direction="vertical" style={[styles.serviceIconContainer, {width}]}>
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
        <AnimatedBox2 direction="vertical" style={[styles.labelContainer, {opacity}]}>
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
        style={Styles.collapseStyles([
          isActive ? styles.activeTabBar : styles.inactiveTabBar,
          isActive && {backgroundColor: serviceIdToAccentColor(service)},
          {transform: [{translateY}]},
        ] as any)}
      />
    </Kb.ClickableBox>
  )
})

// const delay = (after: Kb.ReAnimated.Adaptable<number>) => {
//   const {greaterOrEq, Clock, Value, startClock, stopClock, cond, set, defined, block, add} = Kb.ReAnimated
//   const clock = new Clock()
//   const time = new Value(400)
//   const when = new Value(0)
//   return block([
//     startClock(clock),
//     cond(defined(when), 0, [set(when, add(clock, time))]),
//     cond(greaterOrEq(clock, when), block([stopClock(clock), after]), 0),
//   ])
// }

// const initialBounce = () => {
//   const {Clock, Value, startClock, stopClock, cond, spring, block, SpringUtils} = Kb.ReAnimated
//   const clock = new Clock()

//   const state = {
//     finished: new Value(0),
//     position: new Value(0),
//     time: new Value(0),
//     velocity: new Value(800),
//   }

//   const config = {
//     ...SpringUtils.makeDefaultConfig(),
//     toValue: new Value(0),
//   }

//   return delay(
//     block([
//       startClock(clock),
//       spring(clock, state, config),
//       cond(state.finished, stopClock(clock)),
//       state.position,
//     ])
//   )
// }

export const ServiceTabBar = (props: Props) => {
  const {onChangeService, offset, services, selectedService} = props

  const onClick = React.useCallback(
    service => {
      onChangeService(service)
    },
    [onChangeService]
  )

  // const height = Kb.ReAnimated.interpolateNode(offset, {
  //   inputRange: [-9999, 0, 100, 9999],
  //   outputRange: [72, 72, 48, 48],
  // })
  // const translateY = Kb.ReAnimated.interpolateNode(offset, {
  //   inputRange: [-9999, 0, 100, 9999],
  //   outputRange: [0, 0, 8, 8],
  // })

  // const bounce = useSharedValue(400)

  const bounceX = useSharedValue(40)

  React.useEffect(() => {
    bounceX.value = 0
  }, [bounceX])

  const animatedStyles = useAnimatedStyle(() => {
    const translateX = withDelay(100, withSpring(bounceX.value, {}))
    const translateY = 0 /*interpolate(offset.value, [0, 100], [0, 8], {
      extrapolateLeft: Extrapolation.CLAMP,
      extrapolateRight: Extrapolation.CLAMP,
    })*/
    const height = interpolate(offset.value, [0, 100], [72, 48], {
      extrapolateLeft: Extrapolation.CLAMP,
      extrapolateRight: Extrapolation.CLAMP,
    })
    return {
      height,
      transform: [{translateX}, {translateY}] as any,
    }
  })

  return (
    <Kb.ReAnimated.ScrollView
      horizontal={true}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={1000}
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
    </Kb.ReAnimated.ScrollView>
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
