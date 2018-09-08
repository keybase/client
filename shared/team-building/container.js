// @flow
import TeamBuilding from '.'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {TypedState, compose, connect, setDisplayName, withStateHandlers} from '../util/container'
import * as Types from '../constants/types/team-building'
import {followStateHelperWithId} from '../constants/search'
import {throttle} from 'lodash'

type OwnProps = {
  // Supplied by withStateHandlers
  searchString: ?string,
  selectedService: ?string,
  highlightedIndex: ?number,
  clearTextTrigger: number,
  onChangeText: (newText: string) => void,
  onChangeService: (newText: string) => void,
  onDownArrowKeyDown: () => void,
  onUpArrowKeyDown: () => void,
  incClearTextTrigger: () => void,
}

type LocalState = {
  searchString: ?string,
  selectedService: ?string,
  highlightedIndex: ?number,
  clearTextTrigger: number,
}

const initialState: LocalState = {
  searchString: null,
  selectedService: null,
  highlightedIndex: null,
  clearTextTrigger: 0,
}

const stateHandlers = {
  onChangeService: (state: LocalState) => (selectedService: string) => ({selectedService}),
  onChangeText: (state: LocalState) => (newText: string) => ({searchString: newText}),
  onDownArrowKeyDown: (state: LocalState) => () => ({
    highlightedIndex: state.highlightedIndex === null ? 0 : state.highlightedIndex + 1,
  }),
  onUpArrowKeyDown: (state: LocalState) => () => ({
    highlightedIndex: !state.highlightedIndex ? null : state.highlightedIndex - 1,
  }),
  incClearTextTrigger: (state: LocalState) => () => ({clearTextTrigger: clearTextTrigger + 1}),
}

const deriveSearchResults = (state: TypedState, searchQuery: string, service: ServiceIdWithContact) => {
  // TODO
  const searchCache = null
  const teamSoFar = []

  const userIds = searchCache.getSearchQuery(searchQuery, service)
  const userInfos = searchCache.getUsersInfo(userIds)

  return userInfos.map(info => ({
    userId: info.id,
    services: info.serviceMap,
    prettyName: info.prettyName,
    followingState: followStateHelperWithId(state, info.id),
    inTeam: teamSoFar.indexOf(info.id),
  }))
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  // TODO
  const serviceResultCountCache = null
  const teamSoFar = null
  let searchResults = null

  if (serviceResultCountCache.hasSearchQuery(ownProps.searchString, ownProps.selectedService)) {
    searchResults = deriveSearchResults(state, ownProps.searchString, ownProps.selectedService)
  }

  return {
    searchResults,
    teamSoFar,
  }
}

const mapDispatchToProps = dispatch => ({
  onAdd: (userId: string) => dispatch(TeamBuildingGen.addUsersToTeamSoFar({users: [userId]})),
  onRemove: (userId: string) => dispatch(TeamBuildingGen.removeUsersFromTeamSoFar({users: [userId]})),
  onFinishTeamBuilding: () => dispatch(TeamBuildingGen.finishedTeamBuilding()),
  _search: (searchQuery: string, service: string) => {
    dispatch(TeamBuildingGen.search(searchQuery, service))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const onChangeText = (newText: string) => {
    ownProps.onChangeText(newText)
    dispatchProps._search(newText, ownProps.service)
  }

  const onEnterKeyDown = (newText: string) => {
    const selectedResult = stateProps.searchResults[ownProps.highlightedIndex || 0]
    if (selectedResult) {
      dispatchProps.onAdd(selectedResult.userId)
    }
    ownProps.incClearTextTrigger()
  }

  return {
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onChangeText,
    onEnterKeyDown,
    onDownArrowKeyDown: ownProps.onDownArrowKeyDown,
    onUpArrowKeyDown: ownProps.onUpArrowKeyDown,
    teamSoFar: stateProps.teamSoFar,
    onRemove: dispatchProps.onRemove,
    onBackspaceWhileEmpty: () => ({}), // TODO
    selectedService: ownProps.selectedService,
    onChangeService: ownProps.onChangeService,
    serviceResultCount: {}, // TODO
    showServiceResultCount: false, // TODO
    searchResults: stateProps.searchResults,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd: dispatchProps.onAdd,
  }
}

// TODO I don't remember the ordering here
const Connected = compose(
  withStateHandlers(initialState, stateHandlers),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('TeamBuilding')
)(TeamBuilding)

export default Connected
