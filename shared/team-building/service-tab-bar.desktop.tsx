import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {
  serviceIdToIconFont,
  serviceIdToAccentColor,
  serviceIdToLabel,
  serviceIdToLongLabel,
  inactiveServiceAccentColor,
} from './shared'
import * as Constants from '../constants/team-building'
import {ServiceIdWithContact} from '../constants/types/team-building'
import {Props, IconProps} from './service-tab-bar'

type ExtraProps = {service: ServiceIdWithContact; isActive: boolean}
const HoverIcon = Styles.styled<typeof Kb.Icon, ExtraProps>(Kb.Icon)(props => ({
  '&:hover': {
    color: serviceIdToAccentColor(props.service),
  },
  color: props.isActive ? serviceIdToAccentColor(props.service) : inactiveServiceAccentColor,
}))

const ServiceIcon = (props: IconProps) => (
  <Kb.ClickableBox onClick={props.onClick} style={{flex: 1}}>
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

const undefToNull = (n: number | undefined | null): number | null => (n === undefined ? null : n)

export const ServiceTabBar = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tabBarContainer}>
    {Constants.services.map(service => (
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
  </Kb.Box2>
)

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
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  tabBarContainer: {
    marginTop: Styles.globalMargins.xtiny,
    minHeight: 30,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
})

export default ServiceTabBar
