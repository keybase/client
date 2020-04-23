import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceIdToLongLabel, serviceIdToBadge} from './shared'
import {Props, IconProps} from './service-tab-bar'

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

// On tablet add an additional "serivce" item that is only a bottom border that extends to the end of the ScrollView
const TabletBottomBorderExtension = React.memo((props: {offset: number; servicesCount: number}) => {
  const translateY = Kb.ReAnimated.interpolate(props.offset, {
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
        ])}
      />
    </Kb.Box2>
  )
})

const ServiceIcon = React.memo((props: IconProps) => {
  const color = props.isActive ? serviceIdToAccentColor(props.service) : Styles.globalColors.black

  const opacity = Kb.ReAnimated.interpolate(props.offset, {
    inputRange: [-9999, 0, 40, 9999],
    outputRange: [1, 1, 0, 0],
  })
  const width = Kb.ReAnimated.interpolate(props.offset, {
    inputRange: [-9999, -100, 0, 100, 9999],
    outputRange: [bigWidth + 5, bigWidth + 5, bigWidth, smallWidth, smallWidth],
  })
  const translateY = Kb.ReAnimated.interpolate(props.offset, {
    inputRange: [-100, 0, 100, 9999],
    outputRange: [0, 0, -8, -8],
  })

  return (
    <Kb.ClickableBox onClick={() => props.onClick(props.service)} style={{position: 'relative'}}>
      <AnimatedBox2 direction="vertical" style={[styles.serviceIconContainer, {width}]}>
        <Kb.Box2 direction="vertical" style={{position: 'relative'}}>
          {serviceIdToBadge(props.service) && (
            <Kb.Badge
              border={true}
              height={9}
              containerStyle={styles.badgeContainerStyle}
              badgeStyle={styles.badgeStyle}
              leftRightPadding={0}
            />
          )}
          <Kb.Icon fontSize={18} type={serviceIdToIconFont(props.service)} color={color} />
        </Kb.Box2>
        <AnimatedBox2 direction="vertical" style={[styles.labelContainer, {opacity}]}>
          <Kb.Box2 direction="vertical" style={{height: labelHeight, width: 74}}>
            <Kb.Box2 direction="vertical">
              {props.label.map((label, i) => (
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
        {!!props.showCount && props.count === null && (
          <Kb.Animation animationType="spinner" style={styles.pendingAnimation} />
        )}
        {!!props.showCount && props.count !== null && (
          <Kb.Text type="BodyTinySemibold">{props.count && props.count === 11 ? '10+' : props.count}</Kb.Text>
        )}
      </AnimatedBox2>
      <AnimatedBox2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([
          props.isActive ? styles.activeTabBar : styles.inactiveTabBar,
          props.isActive && {backgroundColor: serviceIdToAccentColor(props.service)},
          {transform: [{translateY}]},
        ])}
      />
    </Kb.ClickableBox>
  )
})

const undefToNull = (n: number | undefined | null): number | null => (n === undefined ? null : n)

const delay = (after: Kb.ReAnimated.Adaptable<number>) => {
  const {greaterOrEq, Clock, Value, startClock, stopClock, cond, set, defined, block, add} = Kb.ReAnimated
  const clock = new Clock()
  const time = new Value(400)
  const when = new Value(0)
  return block([
    startClock(clock),
    cond(defined(when), 0, [set(when, add(clock, time))]),
    cond(greaterOrEq(clock, when), block([stopClock(clock), after]), 0),
  ])
}

const initialBounce = () => {
  const {Clock, Value, startClock, stopClock, cond, spring, block, SpringUtils} = Kb.ReAnimated
  const clock = new Clock()

  const state = {
    finished: new Value(0),
    position: new Value(0),
    time: new Value(0),
    velocity: new Value(800),
  }

  const config = {
    ...SpringUtils.makeDefaultConfig(),
    toValue: new Value(0),
  }

  return delay(
    block([
      startClock(clock),
      spring(clock, state, config),
      cond(state.finished, stopClock(clock)),
      state.position,
    ])
  )
}

export class ServiceTabBar extends React.PureComponent<Props> {
  private onClick = service => {
    this.props.onChangeService(service)
  }

  private bounce = initialBounce()

  render() {
    const props = this.props

    const height = Kb.ReAnimated.interpolate(props.offset, {
      inputRange: [-9999, 0, 100, 9999],
      outputRange: [72, 72, 48, 48],
    })
    const translateY = Kb.ReAnimated.interpolate(props.offset, {
      inputRange: [-9999, 0, 100, 9999],
      outputRange: [0, 0, 8, 8],
    })

    return (
      <Kb.ReAnimated.ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={1000}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={Styles.collapseStyles([{height: '100%'}, Styles.isTablet && {width: '100%'}])}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          height,
          transform: [{translateX: this.bounce, translateY}] as any,
          width: '100%',
        }}
      >
        {props.services.map(service => (
          <ServiceIcon
            key={service}
            offset={props.offset}
            service={service}
            label={serviceIdToLongLabel(service)}
            onClick={this.onClick}
            count={undefToNull(props.serviceResultCount[service])}
            showCount={props.showServiceResultCount}
            isActive={props.selectedService === service}
          />
        ))}
        {Styles.isTablet ? (
          <TabletBottomBorderExtension offset={props.offset} servicesCount={props.services.length} />
        ) : null}
      </Kb.ReAnimated.ScrollView>
    )
  }
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
