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
  <Kb.ClickableBox onClick={props.onClick}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.serviceIconContainer}>
      <Kb.Icon
        type={serviceIdToIconFont(props.service)}
        style={Styles.collapseStyles([
          styles.serviceIcon,
          {color: props.isActive ? serviceIdToAccentColor(props.service) : inactiveServiceAccentColor},
        ])}
      />
      {!!props.showCount &&
        (props.count ? (
          <Kb.Text type="BodyTinySemibold" style={styles.resultCount}>
            {props.count > 10 ? '10+' : props.count}
          </Kb.Text>
        ) : (
          <Kb.Icon
            type="icon-progress-grey-animated"
            color={Styles.globalColors.grey}
            style={{height: 10, width: 10}}
          />
        ))}
    </Kb.Box2>
  </Kb.ClickableBox>
)

const ServiceTabBar = (props: Props) => (
  <Kb.Box2 direction="horizontal">
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
  container: Styles.platformStyles({
    isElectron: {
      height: 40,
      marginLeft: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.large, // small
      width: 370,
    },
    common: {
      ...Styles.globalStyles.rounded,
      borderColor: Styles.globalColors.black_20,
      borderWidth: 1,
      borderStyle: 'solid',
    },
  }),
  serviceIconContainer: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
  },
  serviceIcon: {},
  activeIcon: {},
  inactiveIcon: {},
  resultCount: {},
})

export default ServiceTabBar
