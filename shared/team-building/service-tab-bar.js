// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor, inactiveServiceAccentColor} from './shared'
import * as Constants from '../constants/team-building'
import type {ServiceIdWithContact} from '../constants/types/team-building'

// TODO
// * Add styles for mobile
// * Add contact icon
// * Add tooltip
// * Add highlighted underline

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

const ServiceIcon = (props: IconProps) => (
  <Kb.ClickableBox onClick={props.onClick} style={styles.clickableServiceIcon}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.serviceIconContainer}>
      <Kb.Icon
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
      style={props.isActive ? styles.activeTabBar : styles.inactiveTabBar}
    />
  </Kb.ClickableBox>
)

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
    height: 1,
  },
  clickableServiceIcon: {
    flex: 1,
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.rounded,
      borderColor: Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
    },
    isElectron: {
      height: 40,
      marginLeft: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.large, // small
      width: 370,
    },
  }),
  inactiveTabBar: {
    backgroundColor: Styles.globalColors.black_20,
    height: 1,
  },
  pendingIcon: {height: 10, width: 10},
  resultCount: {},
  serviceIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  serviceIconContainer: {
    flex: 1,
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
    minWidth: 40,
  },
  tabBarContainer: {
    height: 30,
  },
})

export default ServiceTabBar
