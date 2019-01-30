// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor, inactiveServiceAccentColor} from './shared'
import * as Constants from '../constants/team-building'
import type {ServiceIdWithContact} from '../constants/types/team-building'

// TODO
// * Add contact icon
// * Add tooltip

type Props = {
  selectedService: ServiceIdWithContact,
  onChangeService: (newService: ServiceIdWithContact) => void,
  serviceResultCount: {[key: ServiceIdWithContact]: ?number},
  showServiceResultCount: boolean,
}

type IconProps = {
  service: ServiceIdWithContact,
  onClick: () => void,
  count: ?number,
  showCount: boolean,
  isActive: boolean,
}

const ServiceIconDesktop = (props: IconProps) => (
  <Kb.ClickableBox onClick={props.onClick} style={styles.clickableServiceIcon}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.serviceIconContainer}>
      <Kb.Icon
        fontSize={18}
        type={serviceIdToIconFont(props.service)}
        style={Styles.collapseStyles([
          styles.serviceIcon,
          {color: props.isActive ? serviceIdToAccentColor(props.service) : inactiveServiceAccentColor},
        ])}
      />
      {!!props.showCount &&
        (Number.isInteger(props.count) ? (
          <Kb.Text type="BodyTinySemibold" style={styles.resultCount}>
            {props.count && props.count > 10 ? '10+' : props.count}
          </Kb.Text>
        ) : (
          <Kb.Icon
            type="icon-progress-grey-animated"
            color={Styles.globalColors.grey}
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
      {!!props.showCount && !Number.isInteger(props.count) ? (
        <Kb.Icon
          type="icon-progress-grey-animated"
          color={Styles.globalColors.grey}
          style={styles.pendingIcon}
        />
      ) : (
        <Kb.Icon
          fontSize={22}
          type={serviceIdToIconFont(props.service)}
          style={Styles.collapseStyles([
            styles.serviceIcon,
            {color: props.isActive ? serviceIdToAccentColor(props.service) : inactiveServiceAccentColor},
          ])}
        />
      )}

      {!!props.showCount && Number.isInteger(props.count) && (
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

const ServiceTabBar = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tabBarContainer}>
    {Constants.services.map(service => (
      <ServiceIcon
        key={service}
        service={service}
        onClick={() => props.onChangeService(service)}
        count={props.serviceResultCount[service]}
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
    isMobile: {height: 18, width: 18},
  }),
  resultCount: {},
  serviceIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
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
    },
    isMobile: {
      height: 58,
    },
  }),
})

export default ServiceTabBar
