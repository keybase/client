import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {
  serviceIdToIconFont,
  serviceIdToAccentColor,
  serviceIdToLongLabel,
  serviceIdToWonderland,
  inactiveServiceAccentColor,
} from './shared'
import {ServiceIdWithContact} from '../constants/types/team-building'
import {Props, IconProps} from './service-tab-bar'
import {difference} from 'lodash-es'

const ServiceIcon = (props: IconProps) => {
  const [hover, setHover] = React.useState(false)
  const color = props.isActive || hover ? serviceIdToAccentColor(props.service) : inactiveServiceAccentColor
  return (
    <Kb.ClickableBox
      onClick={props.onClick}
      onMouseOver={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{flex: 1}}
    >
      <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.serviceIconContainer}>
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          fullHeight={true}
          style={styles.serviceIconContainerInner}
        >
          <Kb.Box2 direction="vertical" style={{position: 'relative'}}>
            {serviceIdToWonderland(props.service) && (
              <Kb.Badge
                border={true}
                height={9}
                containerStyle={styles.badgeContainerStyle}
                badgeStyle={styles.badgeStyle}
                leftRightPadding={0}
              />
            )}
            <Kb.Icon
              fontSize={16}
              type={serviceIdToIconFont(props.service)}
              style={Styles.collapseStyles([styles.serviceIcon, {color}])}
              boxStyle={styles.serviceIconBox}
            />
          </Kb.Box2>
          <Kb.Text
            type="BodyTiny"
            center={true}
            lineClamp={2}
            style={Styles.collapseStyles([styles.label, {color}])}
          >
            {props.label}
            {serviceIdToWonderland(props.service) && (
              <Kb.Text type="Body" style={styles.wonderland}>
                {' '}
                <Kb.Emoji size={16} emojiName=":rabbit2:" />
              </Kb.Text>
            )}
          </Kb.Text>
          {!!props.showCount &&
            (props.count !== null ? (
              <Kb.Text type="BodyTinySemibold">
                {props.count && props.count > 10 ? '10+' : props.count}
              </Kb.Text>
            ) : (
              <Kb.Icon
                type="icon-progress-grey-animated"
                color={Styles.globalColors.greyDark}
                style={styles.pendingIcon}
              />
            ))}
        </Kb.Box2>
      </Kb.Box2>
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

const MoreNetworksButton = Kb.OverlayParentHOC(
  (
    props: Kb.PropsWithOverlay<{
      services: Array<ServiceIdWithContact>
      onChangeService: (service: ServiceIdWithContact) => void
    }>
  ) => (
    <>
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.moreNetworks0}>
        <Kb.Box2
          direction="vertical"
          style={styles.moreNetworks1}
          fullHeight={true}
          centerChildren={true}
          ref={props.setAttachmentRef}
        >
          <Kb.WithTooltip text="More networks" containerStyle={styles.moreNetworks2}>
            <Kb.ClickableBox onClick={props.toggleShowingMenu} style={styles.moreNetworks3}>
              <Kb.Text type="BodyBigExtrabold" style={styles.moreText}>
                •••
              </Kb.Text>
            </Kb.ClickableBox>
          </Kb.WithTooltip>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inactiveTabBar} />
      </Kb.Box2>
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        closeOnSelect={true}
        items={props.services.map(service => ({
          onClick: () => props.onChangeService(service),
          title: service,
          view: <MoreNetworkItem service={service} />,
        }))}
        onHidden={props.toggleShowingMenu}
        visible={props.showingMenu}
      />
    </>
  )
)

const MoreNetworkItem = (props: {service: ServiceIdWithContact}) => (
  <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
    <Kb.Icon
      style={styles.moreNetworkItemIcon}
      color={Styles.globalColors.black}
      type={serviceIdToIconFont(props.service)}
    />
    <Kb.Text type="Body">{serviceIdToLongLabel(props.service)}</Kb.Text>
  </Kb.Box2>
)

const undefToNull = (n: number | undefined | null): number | null => (n === undefined ? null : n)

export const ServiceTabBar = (props: Props) => {
  const [
    lastSelectedUnlockedService,
    setLastSelectedUnlockedService,
  ] = React.useState<ServiceIdWithContact | null>(null)
  const {services, onChangeService: propsOnChangeService} = props
  const nLocked = 3 // Services always out front on the left. Add one to get the number out front.
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
          labelPresence={1}
          onClick={() => onChangeService(service)}
          count={undefToNull(props.serviceResultCount[service])}
          showCount={props.showServiceResultCount}
          isActive={props.selectedService === service}
        />
      ))}
      {moreServices.length > 0 && (
        <MoreNetworksButton services={moreServices} onChangeService={onChangeService} />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  activeTabBar: {
    backgroundColor: Styles.globalColors.blue,
    height: 2,
  },
  badgeContainerStyle: {
    position: 'absolute',
    right: 0,
    top: 10,
  },
  badgeStyle: {backgroundColor: Styles.globalColors.blue},
  inactiveTabBar: {
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    height: 2,
  },
  label: {
    marginTop: Styles.globalMargins.xtiny,
    minWidth: 64,
  },
  moreNetworkItemIcon: {marginRight: Styles.globalMargins.tiny},
  moreNetworks0: {
    flex: 1,
  },
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
  moreText: {
    color: Styles.globalColors.black_50,
  },
  pendingIcon: {height: 10, width: 10},
  serviceIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  serviceIconBox: {
    marginTop: 14,
  },
  serviceIconContainer: {
    flex: 1,
    height: 70,
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
    maxWidth: 72,
    minWidth: 40,
  },
  serviceIconContainerInner: {
    justifyContent: 'flex-start',
  },
  tabBarContainer: {
    minHeight: 30,
  },
  wonderland: {
    color: Styles.globalColors.white,
  },
}))

export default ServiceTabBar
