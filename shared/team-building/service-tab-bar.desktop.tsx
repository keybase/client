import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {
  serviceIdToIconFont,
  serviceIdToAccentColor,
  serviceIdToLongLabel,
  inactiveServiceAccentColor,
} from './shared'
import * as Constants from '../constants/team-building'
import {ServiceIdWithContact} from '../constants/types/team-building'
import {Props, IconProps} from './service-tab-bar'

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
          <Kb.Icon
            fontSize={16}
            type={serviceIdToIconFont(props.service)}
            style={Styles.collapseStyles([styles.serviceIcon, {color}])}
            boxStyle={styles.serviceIconBox}
          />
          <Kb.Text type="BodyTiny" center={true} lineClamp={2} style={styles.label}>
            {props.label}
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
  <Kb.Box2 direction="horizontal" fullHeight={true} alignItems={'center'}>
    <Kb.Icon
      style={{marginRight: Styles.globalMargins.tiny}}
      fontSize={16}
      type={serviceIdToIconFont(props.service)}
    />
    <Kb.Text type="Body">{serviceIdToLongLabel(props.service)}</Kb.Text>
  </Kb.Box2>
)

const undefToNull = (n: number | undefined | null): number | null => (n === undefined ? null : n)

export const ServiceTabBar = (props: Props) => {
  const [lastSelectedUnlockedService, setState] = React.useState<ServiceIdWithContact | null>(null)
  const nLocked = 3 // Services always out front on the left. Add one to get the number out front.
  const lockedServices = Constants.services.slice(0, nLocked)
  let frontServices = lockedServices
  if (Constants.services.indexOf(props.selectedService) < nLocked) {
    // Selected service is locked
    if (lastSelectedUnlockedService === null) {
      frontServices = lockedServices.concat(Constants.services.slice(nLocked, nLocked + 1))
    } else {
      frontServices = lockedServices.concat([lastSelectedUnlockedService])
    }
  } else {
    frontServices = lockedServices.concat([props.selectedService])
    if (lastSelectedUnlockedService !== props.selectedService) {
      setState(props.selectedService)
    }
  }
  const moreServices = Constants.services.slice(nLocked)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tabBarContainer}>
      {frontServices.slice(0, 4).map(service => (
        <ServiceIcon
          key={service}
          service={service}
          label={serviceIdToLongLabel(service)}
          labelPresence={1}
          onClick={() => props.onChangeService(service)}
          count={undefToNull(props.serviceResultCount[service])}
          showCount={props.showServiceResultCount}
          isActive={props.selectedService === service}
        />
      ))}
      {!!(moreServices.length > 0) && (
        <MoreNetworksButton services={moreServices} onChangeService={props.onChangeService} />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  activeTabBar: {
    backgroundColor: Styles.globalColors.blue,
    height: 2,
  },
  inactiveTabBar: {
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    height: 2,
  },
  label: {
    marginTop: Styles.globalMargins.xtiny,
    minWidth: 64,
  },
  moreNetworks1: {
    flex: 1,
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
    marginTop: Styles.globalMargins.xtiny,
    minHeight: 30,
  },
})

export default ServiceTabBar
