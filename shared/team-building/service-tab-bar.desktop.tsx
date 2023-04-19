import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceIdToLongLabel, serviceIdToBadge} from './shared'
import difference from 'lodash/difference'
import type {ServiceIdWithContact} from '../constants/types/team-building'
import type {Props, IconProps} from './service-tab-bar'

const ServiceIcon = (props: IconProps) => {
  const [hover, setHover] = React.useState(false)
  const color = props.isActive || hover ? serviceIdToAccentColor(props.service) : Styles.globalColors.black
  return (
    <Kb.ClickableBox
      onClick={() => props.onClick(props.service)}
      onMouseOver={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={styles.serviceIconFlex}
    >
      <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.serviceIconContainer}>
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          fullHeight={true}
          style={styles.serviceIconContainerInner}
        >
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
            <Kb.Icon
              color={color}
              fontSize={16}
              type={serviceIdToIconFont(props.service)}
              boxStyle={styles.serviceIconBox}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.label}>
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
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([
          props.isActive
            ? styles.activeTabBar
            : {...styles.inactiveTabBar, ...(props.minimalBorder ? {borderBottomWidth: 0} : undefined)},
          props.isActive && {backgroundColor: serviceIdToAccentColor(props.service)},
        ])}
      />
    </Kb.ClickableBox>
  )
}

const MoreNetworksButton = (props: {
  services: Array<ServiceIdWithContact>
  onChangeService: (service: ServiceIdWithContact) => void
}) => {
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={props.services.map(service => ({
        onClick: () => props.onChangeService(service),
        title: service,
        view: <MoreNetworkItem service={service} />,
      }))}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
    />
  ))

  return (
    <>
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.moreNetworks0}>
        <Kb.Box2
          direction="vertical"
          style={styles.moreNetworks1}
          fullHeight={true}
          centerChildren={true}
          ref={popupAnchor}
        >
          <Kb.WithTooltip tooltip="More networks" containerStyle={styles.moreNetworks2}>
            <Kb.ClickableBox onClick={toggleShowingPopup} style={styles.moreNetworks3}>
              <Kb.Text type="BodyBigExtrabold" style={styles.moreText}>
                •••
              </Kb.Text>
            </Kb.ClickableBox>
          </Kb.WithTooltip>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inactiveTabBar} />
      </Kb.Box2>
      {popup}
    </>
  )
}

const MoreNetworkItem = (props: {service: ServiceIdWithContact}) => (
  <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
    <Kb.Icon
      style={styles.moreNetworkItemIcon}
      color={serviceIdToAccentColor(props.service)}
      type={serviceIdToIconFont(props.service)}
    />
    <Kb.Text type="Body">{serviceIdToLongLabel(props.service).join(' ')}</Kb.Text>
  </Kb.Box2>
)

export const ServiceTabBar = (props: Props) => {
  const [lastSelectedUnlockedService, setLastSelectedUnlockedService] =
    React.useState<ServiceIdWithContact | null>(null)
  const {services, onChangeService: propsOnChangeService, servicesShown: nLocked = 3} = props
  const onChangeService = React.useCallback(
    (service: ServiceIdWithContact) => {
      if (services.indexOf(service) >= nLocked && service !== lastSelectedUnlockedService) {
        setLastSelectedUnlockedService(service)
      }
      propsOnChangeService(service)
    },
    [services, lastSelectedUnlockedService, nLocked, propsOnChangeService, setLastSelectedUnlockedService]
  )
  const lockedServices = services.slice(0, nLocked)
  let frontServices = lockedServices
  if (services.indexOf(props.selectedService) < nLocked) {
    // Selected service is locked
    if (lastSelectedUnlockedService === null) {
      frontServices = services.slice(0, nLocked + 1)
    } else {
      frontServices = lockedServices.concat([lastSelectedUnlockedService])
    }
  } else {
    frontServices = lockedServices.concat([props.selectedService])
  }
  const moreServices = difference(services, frontServices)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tabBarContainer}>
      {frontServices.map(service => (
        <ServiceIcon
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
        top: 10,
      },
      badgeStyle: {backgroundColor: Styles.globalColors.blue},
      inactiveTabBar: {height: 2},
      label: {
        marginTop: Styles.globalMargins.xtiny,
        minWidth: 64,
      },
      moreNetworkItemIcon: {marginRight: Styles.globalMargins.tiny},
      moreNetworks0: {flex: 1},
      moreNetworks1: {
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
        paddingTop: Styles.globalMargins.tiny,
      },
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
        alignItems: 'center',
        borderColor: Styles.globalColors.black_20,
        borderRadius: 4,
        borderStyle: 'solid',
        borderWidth: 1,
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        justifyContent: 'center',
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
      },
      moreText: {color: Styles.globalColors.black_50},
      pendingAnimation: {height: 10, width: 10},
      serviceIconBox: {marginTop: 14},
      serviceIconContainer: {
        flex: 1,
        height: 70,
        marginLeft: Styles.globalMargins.xtiny,
        marginRight: Styles.globalMargins.xtiny,
        maxWidth: 72,
        minWidth: 40,
      },
      serviceIconContainerInner: {justifyContent: 'flex-start'},
      serviceIconFlex: {
        flex: 1,
        maxWidth: 90,
      },
      tabBarContainer: {
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        flexShrink: 0,
        minHeight: 30,
      },
    } as const)
)

export default ServiceTabBar
