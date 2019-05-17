"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const go_button_1 = require("./go-button");
const Kb = require("../common-adapters/index");
const Styles = require("../styles");
const team_box_1 = require("./team-box");
const service_tab_bar_1 = require("./service-tab-bar");
const user_result_1 = require("./user-result");
const feature_flags_1 = require("../util/feature-flags");
const shared_1 = require("./shared");
class TeamBuilding extends React.PureComponent {
    constructor() {
        super(...arguments);
        this.componentDidMount = () => {
            this.props.fetchUserRecs();
        };
        this.render = () => {
            const props = this.props;
            const showRecPending = !props.searchString && !props.recommendations;
            const showLoading = !!props.searchString && !props.searchResults;
            const showRecs = props.showRecs;
            return (<Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
        {Styles.isMobile && (<Kb.Box2 direction="horizontal" fullWidth={true}>
            <team_box_1.default onChangeText={props.onChangeText} onDownArrowKeyDown={props.onDownArrowKeyDown} onUpArrowKeyDown={props.onUpArrowKeyDown} onEnterKeyDown={props.onEnterKeyDown} onFinishTeamBuilding={props.onFinishTeamBuilding} onRemove={props.onRemove} teamSoFar={props.teamSoFar} onBackspace={props.onBackspace} searchString={props.searchString}/>
            {!!props.teamSoFar.length && !Styles.isMobile && (<go_button_1.default onClick={props.onFinishTeamBuilding}/>)}
          </Kb.Box2>)}
        {!Styles.isMobile && (<team_box_1.default onChangeText={props.onChangeText} onDownArrowKeyDown={props.onDownArrowKeyDown} onUpArrowKeyDown={props.onUpArrowKeyDown} onEnterKeyDown={props.onEnterKeyDown} onFinishTeamBuilding={props.onFinishTeamBuilding} onRemove={props.onRemove} teamSoFar={props.teamSoFar} onBackspace={props.onBackspace} searchString={props.searchString}/>)}
        {!!props.teamSoFar.length && feature_flags_1.default.newTeamBuildingForChatAllowMakeTeam && (<Kb.Text type="BodySmall">
            Add up to 14 more people. Need more?
            <Kb.Text type="BodySmallPrimaryLink" onClick={props.onMakeItATeam}>
              {' '}
              Make it a team.
            </Kb.Text>
          </Kb.Text>)}
        <service_tab_bar_1.default selectedService={props.selectedService} onChangeService={props.onChangeService} serviceResultCount={props.serviceResultCount} showServiceResultCount={props.showServiceResultCount}/>
        {showRecPending || showLoading ? (<Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.loadingContainer}>
            <Kb.Icon style={Kb.iconCastPlatformStyles(styles.loadingIcon)} type="icon-progress-grey-animated"/>
            <Kb.Text type="BodySmallSemibold">Loading</Kb.Text>
          </Kb.Box2>) : !showRecs && !props.showServiceResultCount && !!props.selectedService ? (<Kb.Box2 alignSelf="center" centerChildren={true} direction="vertical" fullHeight={true} fullWidth={true} gap="tiny" style={styles.emptyContainer}>
            <Kb.Icon fontSize={Styles.isMobile ? 48 : 64} type={shared_1.serviceIdToIconFont(props.selectedService)} style={Styles.collapseStyles([
                !!props.selectedService && { color: shared_1.serviceIdToAccentColor(props.selectedService) },
            ])}/>
            <Kb.Text center={true} type="BodyBig">
              Enter a {shared_1.serviceIdToLabel(props.selectedService)} username above.
            </Kb.Text>
            <Kb.Text center={true} type="BodySmall">
              Start a Keybase chat with anyone on {shared_1.serviceIdToLabel(props.selectedService)}, even if they
              don’t have a Keybase account.
            </Kb.Text>
          </Kb.Box2>) : (<Kb.List items={showRecs ? props.recommendations || [] : props.searchResults || []} selectedIndex={props.highlightedIndex || 0} style={styles.list} contentContainerStyle={styles.listContentContainer} keyProperty={'userId'} onEndReached={props.onSearchForMore} renderItem={(index, result) => (<user_result_1.default resultForService={props.selectedService} fixedHeight={400} username={result.username} prettyName={result.prettyName} services={result.services} inTeam={result.inTeam} followingState={result.followingState} highlight={index === props.highlightedIndex} onAdd={() => props.onAdd(result.userId)} onRemove={() => props.onRemove(result.userId)}/>)}/>)}
        {props.waitingForCreate && (<Kb.Box2 direction="vertical" style={styles.waiting} alignItems="center">
            <Kb.ProgressIndicator type="Small" white={true} style={styles.waitingProgress}/>
          </Kb.Box2>)}
      </Kb.Box2>);
        };
    }
}
const styles = Styles.styleSheetCreate({
    container: Styles.platformStyles({
        common: {
            flex: 1,
            minHeight: 200,
            position: 'relative',
        },
        isElectron: {
            borderRadius: 4,
            height: 434,
            overflow: 'hidden',
            width: 470,
        },
    }),
    emptyContainer: Styles.platformStyles({
        common: {
            flex: 1,
        },
        isElectron: {
            maxWidth: 290,
            paddingBottom: 40,
        },
        isMobile: {
            maxWidth: '80%',
        },
    }),
    list: Styles.platformStyles({
        common: {
            paddingBottom: Styles.globalMargins.small,
        },
        isElectron: {
            marginLeft: Styles.globalMargins.small,
            marginRight: Styles.globalMargins.small,
        },
    }),
    listContentContainer: Styles.platformStyles({
        isMobile: {
            paddingTop: Styles.globalMargins.xtiny,
        },
    }),
    loadingContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    loadingIcon: Styles.platformStyles({
        isElectron: {
            height: 32,
            width: 32,
        },
        isMobile: {
            height: 48,
            width: 48,
        },
    }),
    mobileFlex: Styles.platformStyles({
        isMobile: { flex: 1 },
    }),
    waiting: Object.assign({}, Styles.globalStyles.fillAbsolute, { backgroundColor: Styles.globalColors.black_20 }),
    waitingProgress: {
        height: 48,
        width: 48,
    },
});
exports.default = TeamBuilding;
//# sourceMappingURL=index.jsx.map