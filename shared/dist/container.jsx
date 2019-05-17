"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const React = require("react");
const I = require("immutable");
const lodash_es_1 = require("lodash-es");
const _1 = require(".");
const WaitingConstants = require("../constants/waiting");
const ChatConstants = require("../constants/chat2");
const TeamBuildingGen = require("../actions/team-building-gen");
const container_1 = require("../util/container");
const idle_callback_1 = require("../util/idle-callback");
const common_adapters_1 = require("../common-adapters");
const platform_1 = require("../constants/platform");
const platforms_1 = require("../util/platforms");
const team_building_1 = require("../constants/team-building");
const memoize_1 = require("../util/memoize");
const initialState = {
    highlightedIndex: 0,
    searchString: '',
    selectedService: 'keybase',
};
const deriveSearchResults = memoize_1.memoize((searchResults, teamSoFar, myUsername, followingState) => searchResults &&
    searchResults.map(info => ({
        followingState: team_building_1.followStateHelperWithId(myUsername, followingState, info.id),
        inTeam: teamSoFar.some(u => u.id === info.id),
        prettyName: info.prettyName,
        services: info.serviceMap,
        userId: info.id,
        username: info.id.split('@')[0],
    })));
const deriveTeamSoFar = memoize_1.memoize((teamSoFar) => teamSoFar.toArray().map(userInfo => {
    const { username, serviceId } = platforms_1.parseUserId(userInfo.id);
    return {
        prettyName: userInfo.prettyName,
        service: serviceId,
        userId: userInfo.id,
        username,
    };
}));
const deriveServiceResultCount = memoize_1.memoize((searchResults, query) => 
// $FlowIssue toObject looses typing
searchResults
    .get(lodash_es_1.trim(query), I.Map())
    .map(results => results.length)
    .toObject());
const deriveShowServiceResultCount = memoize_1.memoize(searchString => !!searchString);
const deriveUserFromUserIdFn = memoize_1.memoize((searchResults, recommendations) => (userId) => (searchResults || []).filter(u => u.id === userId)[0] ||
    (recommendations || []).filter(u => u.id === userId)[0] ||
    null);
const mapStateToProps = (state, ownProps) => {
    const userResults = state.chat2.teamBuildingSearchResults.getIn([
        lodash_es_1.trim(ownProps.searchString),
        ownProps.selectedService,
    ]);
    return {
        recommendations: deriveSearchResults(state.chat2.teamBuildingUserRecs, state.chat2.teamBuildingTeamSoFar, state.config.username, state.config.following),
        searchResults: deriveSearchResults(userResults, state.chat2.teamBuildingTeamSoFar, state.config.username, state.config.following),
        serviceResultCount: deriveServiceResultCount(state.chat2.teamBuildingSearchResults, ownProps.searchString),
        showServiceResultCount: deriveShowServiceResultCount(ownProps.searchString),
        teamSoFar: deriveTeamSoFar(state.chat2.teamBuildingTeamSoFar),
        userFromUserId: deriveUserFromUserIdFn(userResults, state.chat2.teamBuildingUserRecs),
        waitingForCreate: WaitingConstants.anyWaiting(state, ChatConstants.waitingKeyCreating),
    };
};
const mapDispatchToProps = dispatch => ({
    _onAdd: (user) => dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({ users: [user] })),
    _onCancelTeamBuilding: () => dispatch(TeamBuildingGen.createCancelTeamBuilding()),
    _search: lodash_es_1.debounce((query, service, limit) => {
        idle_callback_1.requestIdleCallback(() => dispatch(TeamBuildingGen.createSearch({ limit, query, service })));
    }, 500),
    fetchUserRecs: () => dispatch(TeamBuildingGen.createFetchUserRecs()),
    onFinishTeamBuilding: () => dispatch(TeamBuildingGen.createFinishedTeamBuilding()),
    onRemove: (userId) => dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({ users: [userId] })),
});
const deriveOnBackspace = memoize_1.memoize((searchString, teamSoFar, onRemove) => () => {
    // Check if empty and we have a team so far
    !searchString && teamSoFar.length && onRemove(teamSoFar[teamSoFar.length - 1].userId);
});
const deriveOnEnterKeyDown = memoize_1.memoizeShallow(({ searchResults, teamSoFar, highlightedIndex, onAdd, onRemove, changeText, searchStringIsEmpty, onFinishTeamBuilding, }) => () => {
    const selectedResult = !!searchResults && searchResults[highlightedIndex];
    if (selectedResult) {
        if (teamSoFar.filter(u => u.userId === selectedResult.userId).length) {
            onRemove(selectedResult.userId);
            changeText('');
        }
        else {
            onAdd(selectedResult.userId);
        }
    }
    else if (searchStringIsEmpty && !!teamSoFar.length) {
        // They hit enter with an empty search string and a teamSoFar
        // We'll Finish the team building
        onFinishTeamBuilding();
    }
});
const deriveOnSearchForMore = memoize_1.memoizeShallow(({ search, searchResults, searchString, selectedService }) => () => {
    if (searchResults && searchResults.length >= 10) {
        search(searchString, selectedService, searchResults.length + 20);
    }
});
const deriveOnAdd = memoize_1.memoize((userFromUserId, dispatchOnAdd, changeText, resetHighlightIndex) => (userId) => {
    const user = userFromUserId(userId);
    if (!user) {
        logger_1.default.error(`Couldn't find User to add for ${userId}`);
        changeText('');
        return;
    }
    changeText('');
    dispatchOnAdd(user);
    resetHighlightIndex(true);
});
const deriveOnChangeText = memoize_1.memoize((onChangeText, search, selectedService, resetHighlightIndex) => (newText) => {
    onChangeText(newText);
    search(newText, selectedService);
    resetHighlightIndex();
});
const deriveOnDownArrowKeyDown = memoize_1.memoize((maxIndex, incHighlightIndex) => () => incHighlightIndex(maxIndex));
const mergeProps = (stateProps, dispatchProps, ownProps) => {
    const { teamSoFar, searchResults, userFromUserId, serviceResultCount, showServiceResultCount, recommendations, waitingForCreate, } = stateProps;
    const showRecs = !ownProps.searchString && !!recommendations && ownProps.selectedService === 'keybase';
    const userResultsToShow = showRecs ? recommendations : searchResults;
    const onChangeText = deriveOnChangeText(ownProps.onChangeText, dispatchProps._search, ownProps.selectedService, ownProps.resetHighlightIndex);
    const onSearchForMore = deriveOnSearchForMore({
        search: dispatchProps._search,
        searchResults,
        searchString: ownProps.searchString,
        selectedService: ownProps.selectedService,
    });
    const onAdd = deriveOnAdd(userFromUserId, dispatchProps._onAdd, ownProps.onChangeText, ownProps.resetHighlightIndex);
    const onEnterKeyDown = deriveOnEnterKeyDown({
        changeText: ownProps.onChangeText,
        highlightedIndex: ownProps.highlightedIndex,
        onAdd,
        onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
        onRemove: dispatchProps.onRemove,
        searchResults: userResultsToShow,
        searchStringIsEmpty: !ownProps.searchString,
        teamSoFar,
    });
    const headerHocProps = platform_1.isMobile
        ? {
            leftAction: 'cancel',
            onLeftAction: dispatchProps._onCancelTeamBuilding,
            rightActions: [
                teamSoFar.length ? { label: 'Start', onPress: dispatchProps.onFinishTeamBuilding } : null,
            ],
            title: 'New chat',
        }
        : {};
    return Object.assign({}, headerHocProps, { fetchUserRecs: dispatchProps.fetchUserRecs, highlightedIndex: ownProps.highlightedIndex, onAdd, onBackspace: deriveOnBackspace(ownProps.searchString, teamSoFar, dispatchProps.onRemove), onChangeService: ownProps.onChangeService, onChangeText, onClosePopup: dispatchProps._onCancelTeamBuilding, onDownArrowKeyDown: deriveOnDownArrowKeyDown((userResultsToShow || []).length - 1, ownProps.incHighlightIndex), onEnterKeyDown, onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding, onMakeItATeam: () => console.log('todo'), onRemove: dispatchProps.onRemove, onSearchForMore, onUpArrowKeyDown: ownProps.decHighlightIndex, recommendations,
        searchResults, searchString: ownProps.searchString, selectedService: ownProps.selectedService, serviceResultCount,
        showRecs,
        showServiceResultCount,
        teamSoFar,
        waitingForCreate });
};
const Connected = container_1.compose(
// @ts-ignore codemode issue
container_1.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'TeamBuilding'), platform_1.isMobile ? common_adapters_1.HeaderHoc : common_adapters_1.PopupDialogHoc)(_1.default);
class StateWrapperForTeamBuilding extends React.Component {
    constructor() {
        super(...arguments);
        this.state = initialState;
        this.onChangeService = (selectedService) => this.setState({ selectedService });
        this.onChangeText = (newText) => this.setState({ searchString: newText });
        this.incHighlightIndex = (maxIndex) => this.setState((state) => ({
            highlightedIndex: Math.min(state.highlightedIndex + 1, maxIndex),
        }));
        this.decHighlightIndex = () => this.setState((state) => ({
            highlightedIndex: state.highlightedIndex < 1 ? 0 : state.highlightedIndex - 1,
        }));
        this.resetHighlightIndex = (resetToHidden) => this.setState({ highlightedIndex: resetToHidden ? -1 : initialState.highlightedIndex });
    }
    render() {
        return (<Connected onChangeService={this.onChangeService} onChangeText={this.onChangeText} incHighlightIndex={this.incHighlightIndex} decHighlightIndex={this.decHighlightIndex} resetHighlightIndex={this.resetHighlightIndex} searchString={this.state.searchString} selectedService={this.state.selectedService} highlightedIndex={this.state.highlightedIndex}/>);
    }
}
exports.default = StateWrapperForTeamBuilding;
//# sourceMappingURL=container.jsx.map