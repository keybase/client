// @flow
import * as I from 'immutable'
import TeamBuilding from '.'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {type TypedState, compose, connect, setDisplayName, withStateHandlers} from '../util/container'
import {parseUserId} from '../util/platforms'
import {followStateHelperWithId} from '../constants/search'
import type {ServiceIdWithContact} from '../constants/types/team-building'

type OwnProps = {
  // Supplied by withStateHandlers
  searchString: ?string,
  selectedService: ServiceIdWithContact,
  highlightedIndex: ?number,
  clearTextTrigger: number,
  onChangeText: (newText: string) => void,
  onChangeService: (newService: ServiceIdWithContact) => void,
  onDownArrowKeyDown: () => void,
  onUpArrowKeyDown: () => void,
  incClearTextTrigger: () => void,
}

type LocalState = {
  searchString: ?string,
  selectedService: ServiceIdWithContact,
  highlightedIndex: ?number,
  clearTextTrigger: number,
}

const initialState: LocalState = {
  searchString: null,
  selectedService: 'keybase',
  highlightedIndex: null,
  clearTextTrigger: 0,
}

const stateHandlers = {
  onChangeService: (state: LocalState) => (selectedService: ServiceIdWithContact) => ({selectedService}),
  onChangeText: (state: LocalState) => (newText: string) => ({searchString: newText}),
  onDownArrowKeyDown: (state: LocalState) => () => ({
    highlightedIndex: state.highlightedIndex === null ? 0 : state.highlightedIndex + 1,
  }),
  onUpArrowKeyDown: (state: LocalState) => () => ({
    highlightedIndex: !state.highlightedIndex ? null : state.highlightedIndex - 1,
  }),
  incClearTextTrigger: (state: LocalState) => () => ({clearTextTrigger: state.clearTextTrigger + 1}),
}

const deriveSearchResults = (state: TypedState, searchQuery: ?string, service: ServiceIdWithContact) => {
  if (!searchQuery) {
    return []
  }

  const userInfos = state.chat2.teamBuildingSearchResults.get(I.List([searchQuery, service])) || []
  const teamSoFar = state.chat2.teamBuildingTeamSoFar

  return userInfos.map(info => ({
    userId: info.id,
    username: info.id.split('@')[0],
    services: info.serviceMap,
    prettyName: info.prettyName,
    followingState: followStateHelperWithId(state, info.id),
    inTeam: teamSoFar.has(info.id),
  }))
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const searchResults = deriveSearchResults(state, ownProps.searchString, ownProps.selectedService)
  const teamSoFar = state.chat2.teamBuildingTeamSoFar.toArray().map(userId => {
    const {username, serviceId} = parseUserId(userId)
    return {
      userId,
      prettyName: username, // TODO
      service: serviceId,
      username,
    }
  })

  return {
    searchResults,
    teamSoFar,
  }
}

const mapDispatchToProps = dispatch => ({
  onAdd: (userId: string) => dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [userId]})),
  onRemove: (userId: string) => dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({users: [userId]})),
  onFinishTeamBuilding: () => dispatch(TeamBuildingGen.createFinishedTeamBuilding()),
  _search: (query: string, service: string) => {
    dispatch(TeamBuildingGen.createSearch({query, service}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const onChangeText = (newText: string) => {
    ownProps.onChangeText(newText)
    dispatchProps._search(newText, ownProps.selectedService)
  }

  const onEnterKeyDown = (newText: string) => {
    if (stateProps.searchResults && !!ownProps.highlightedIndex && ownProps.highlightedIndex >= 0) {
      const selectedResult = stateProps.searchResults[ownProps.highlightedIndex]
      if (selectedResult) {
        dispatchProps.onAdd(selectedResult.userId)
      }
      ownProps.incClearTextTrigger()
    }
  }

  return {
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onChangeText,
    onEnterKeyDown,
    onDownArrowKeyDown: ownProps.onDownArrowKeyDown,
    onUpArrowKeyDown: ownProps.onUpArrowKeyDown,
    teamSoFar: stateProps.teamSoFar,
    onRemove: dispatchProps.onRemove,
    onBackspaceWhileEmpty: () => {}, // TODO
    selectedService: ownProps.selectedService,
    onChangeService: ownProps.onChangeService,
    serviceResultCount: {}, // TODO
    showServiceResultCount: false, // TODO
    searchResults: stateProps.searchResults,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd: dispatchProps.onAdd,
    clearTextTrigger: ownProps.clearTextTrigger,
  }
}

// TODO I don't remember the ordering here
const Connected = compose(
  withStateHandlers(initialState, stateHandlers),
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('TeamBuilding')
)(TeamBuilding)

export default Connected
