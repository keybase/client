import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {
  serviceIdToIconFont,
  serviceIdToAccentColor,
  serviceIdToLabel,
  inactiveServiceAccentColor,
} from './shared'
import * as Constants from '../constants/team-building'
import {ServiceIdWithContact} from '../constants/types/team-building'

type Props = {
  selectedService: ServiceIdWithContact
  onChangeService: (newService: ServiceIdWithContact) => void
  serviceResultCount: {[K in ServiceIdWithContact]?: number | null}
  showServiceResultCount: boolean
}

type IconProps = {
  service: ServiceIdWithContact
  onClick: () => void
  count: number | null
  showCount: boolean
  isActive: boolean
}

type ExtraProps = {service: ServiceIdWithContact; isActive: boolean}
const HoverIcon = Styles.styled<typeof Kb.Icon, ExtraProps>(Kb.Icon)(props => ({
  '&:hover': {
    color: serviceIdToAccentColor(props.service),
  },
  color: props.isActive ? serviceIdToAccentColor(props.service) : inactiveServiceAccentColor,
}))

const ServiceIconDesktop = (props: IconProps) => (
  <Kb.ClickableBox onClick={props.onClick} style={styles.clickableServiceIcon}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.serviceIconContainer}>
      <Kb.WithTooltip text={serviceIdToLabel(props.service)}>
        <HoverIcon
          isActive={props.isActive}
          service={props.service}
          fontSize={18}
          type={serviceIdToIconFont(props.service)}
          style={styles.serviceIcon}
        />
      </Kb.WithTooltip>
      {props.showCount &&
        (props.count !== null ? (
          <Kb.Text type="BodyTinySemibold" style={styles.resultCount}>
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

const ServiceIconMobile = (props: IconProps) => (
  <Kb.ClickableBox onClick={props.onClick} style={styles.clickableServiceIcon}>
    <Kb.Box2 direction="vertical" centerChildren={true} style={styles.serviceIconContainer}>
      <Kb.Icon
        fontSize={18}
        type={serviceIdToIconFont(props.service)}
        style={Styles.collapseStyles([
          styles.serviceIcon,
          {color: props.isActive ? serviceIdToAccentColor(props.service) : inactiveServiceAccentColor},
        ])}
      />
      {!!props.showCount && props.count === null && (
        <Kb.Icon
          type="icon-progress-grey-animated"
          color={Styles.globalColors.greyDark}
          style={styles.pendingIcon}
        />
      )}
      {!!props.showCount && props.count !== null && (
        <Kb.Text type="BodyTinySemibold" style={styles.resultCount}>
          {props.count && props.count === 11 ? '10+' : props.count}
        </Kb.Text>
      )}
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

const ServiceIcon = Styles.isMobile ? ServiceIconMobile : ServiceIconDesktop

const undefToNull = (n: number | undefined | null): number | null => (n === undefined ? null : n)

const ServiceTabBar = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tabBarContainer}>
    {Constants.services.map(service => (
      <ServiceIcon
        key={service}
        service={service}
        onClick={() => props.onChangeService(service)}
        count={undefToNull(props.serviceResultCount[service])}
        showCount={props.showServiceResultCount}
        isActive={props.selectedService === service}
      />
    ))}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  activeTabBar: {
    backgroundColor: Styles.globalColors.blue,
    height: 2,
  },
  clickableServiceIcon: {
    flex: 1,
  },
  inactiveTabBar: {
    backgroundColor: Styles.globalColors.black_10,
    height: 1,
  },
  pendingIcon: Styles.platformStyles({
    isElectron: {height: 10, width: 10},
    isMobile: {height: 17, width: 17},
  }),
  resultCount: {},
  serviceIcon: Styles.platformStyles({
    isElectron: {
      marginRight: Styles.globalMargins.xtiny,
    },
  }),
  serviceIconContainer: {
    flex: 1,
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
    minWidth: 40,
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  tabBarContainer: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      minHeight: 30,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      height: 58,
    },
  }),
})

export default ServiceTabBar
