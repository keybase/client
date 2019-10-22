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

const ServiceIcon = (props: IconProps) => {
  const color = props.isActive ? serviceIdToAccentColor(props.service) : Styles.globalColors.black
  const opacity = Kb.ReAnimated.interpolate(props.offset, {
    inputRange: [-9999, 0, 100, 9999],
    outputRange: [1, 1, 0, 0],
  })

  const width = Kb.ReAnimated.interpolate(props.offset, {
    inputRange: [-9999, -100, 0, 100, 9999],
    outputRange: [bigWidth + 5, bigWidth + 5, bigWidth, smallWidth, smallWidth],
  })
  return (
    <Kb.ClickableBox onClick={props.onClick}>
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
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([
          props.isActive ? styles.activeTabBar : styles.inactiveTabBar,
          props.isActive && {backgroundColor: serviceIdToAccentColor(props.service)},
        ])}
      />
    </Kb.ClickableBox>
  )
}

const undefToNull = (n: number | undefined | null): number | null => (n === undefined ? null : n)

export class ServiceTabBar extends React.Component<Props> {
  private onClick = service => {
    this.props.onChangeService(service)
  }
  render() {
    const props = this.props

    const height = Kb.ReAnimated.interpolate(props.offset, {
      inputRange: [-9999, 0, 100, 9999],
      outputRange: [72, 72, 40, 40],
    })

    return (
      <Kb.ReAnimated.ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={1000}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          height,
          width: '100%',
        }}
      >
        {props.services.map(service => (
          <ServiceIcon
            key={service}
            offset={props.offset}
            service={service}
            label={serviceIdToLongLabel(service)}
            onClick={() => this.onClick(service)}
            count={undefToNull(props.serviceResultCount[service])}
            showCount={props.showServiceResultCount}
            isActive={props.selectedService === service}
          />
        ))}
      </Kb.ReAnimated.ScrollView>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      activeTabBar: {
        backgroundColor: Styles.globalColors.blue,
        height: 2,
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
        height: 2,
      },
      labelContainer: {
        marginTop: Styles.globalMargins.xtiny,
        overflow: 'hidden',
      },
      pendingAnimation: {height: 17, width: 17},
      serviceIconContainer: {
        alignSelf: 'center',
        height: '100%',
        paddingBottom: Styles.globalMargins.tiny,
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
