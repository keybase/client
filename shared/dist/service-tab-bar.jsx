"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const Kb = require("../common-adapters/index");
const Styles = require("../styles");
const shared_1 = require("./shared");
const Constants = require("../constants/team-building");
const HoverIcon = Styles.styled(Kb.Icon)(props => ({
    '&:hover': {
        color: shared_1.serviceIdToAccentColor(props.service),
    },
    color: props.isActive ? shared_1.serviceIdToAccentColor(props.service) : shared_1.inactiveServiceAccentColor,
}));
const ServiceIconDesktop = (props) => (<Kb.ClickableBox onClick={props.onClick} style={styles.clickableServiceIcon}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.serviceIconContainer}>
      <Kb.WithTooltip text={shared_1.serviceIdToLabel(props.service)}>
        <HoverIcon isActive={props.isActive} service={props.service} fontSize={18} type={shared_1.serviceIdToIconFont(props.service)} style={styles.serviceIcon}/>
      </Kb.WithTooltip>
      {!!props.showCount &&
    (Number.isInteger(props.count) ? (<Kb.Text type="BodyTinySemibold" style={styles.resultCount}>
            {props.count && props.count > 10 ? '10+' : props.count}
          </Kb.Text>) : (<Kb.Icon type="icon-progress-grey-animated" color={Styles.globalColors.greyDark} style={styles.pendingIcon}/>))}
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={Styles.collapseStyles([
    props.isActive ? styles.activeTabBar : styles.inactiveTabBar,
    props.isActive && { backgroundColor: shared_1.serviceIdToAccentColor(props.service) },
])}/>
  </Kb.ClickableBox>);
const ServiceIconMobile = (props) => (<Kb.ClickableBox onClick={props.onClick} style={styles.clickableServiceIcon}>
    <Kb.Box2 direction="vertical" centerChildren={true} style={styles.serviceIconContainer}>
      <Kb.Icon fontSize={18} type={shared_1.serviceIdToIconFont(props.service)} style={Styles.collapseStyles([
    styles.serviceIcon,
    { color: props.isActive ? shared_1.serviceIdToAccentColor(props.service) : shared_1.inactiveServiceAccentColor },
])}/>
      {!!props.showCount && !Number.isInteger(props.count) && (<Kb.Icon type="icon-progress-grey-animated" color={Styles.globalColors.greyDark} style={styles.pendingIcon}/>)}
      {!!props.showCount && Number.isInteger(props.count) && (<Kb.Text type="BodyTinySemibold" style={styles.resultCount}>
          {props.count && props.count === 11 ? '10+' : props.count}
        </Kb.Text>)}
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={Styles.collapseStyles([
    props.isActive ? styles.activeTabBar : styles.inactiveTabBar,
    props.isActive && { backgroundColor: shared_1.serviceIdToAccentColor(props.service) },
])}/>
  </Kb.ClickableBox>);
const ServiceIcon = Styles.isMobile ? ServiceIconMobile : ServiceIconDesktop;
const ServiceTabBar = (props) => (<Kb.Box2 direction="horizontal" fullWidth={true} style={styles.tabBarContainer}>
    {Constants.services.map(service => (<ServiceIcon key={service} service={service} onClick={() => props.onChangeService(service)} count={props.serviceResultCount[service]} showCount={props.showServiceResultCount} isActive={props.selectedService === service}/>))}
  </Kb.Box2>);
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
        isElectron: { height: 10, width: 10 },
        isMobile: { height: 17, width: 17 },
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
});
exports.default = ServiceTabBar;
//# sourceMappingURL=service-tab-bar.jsx.map