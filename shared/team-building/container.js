// @flow
import logger from '../logger'
import React from 'react'
import * as I from 'immutable'
import {debounce} from 'lodash-es'
import TeamBuilding from '.'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {type TypedState, compose, connect, setDisplayName, createSelector} from '../util/container'
import {PopupDialogHoc} from '../common-adapters'
import {parseUserId} from '../util/platforms'
import {followStateHelperWithId} from '../constants/team-building'
import memoizeOne from 'memoize-one'
import type {ServiceIdWithContact, User} from '../constants/types/team-building'

// TODO
// * there's a lot of render thrashing going on. using keyboard arrows is kinda slow becuase of it.
// * Limit the highlight index to the max lenght of the list

type OwnProps = {
  // Supplied by StateComponent
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
  highlightedIndex: 0,
  clearTextTrigger: 0,
}

const searchResultsSelector = (state: TypedState, ownProps: OwnProps) =>
  state.chat2.teamBuildingSearchResults.get(I.List([ownProps.searchString, ownProps.selectedService]))

const searchResultsPropSelector = createSelector(
  searchResultsSelector,
  (state: TypedState) => state.chat2.teamBuildingTeamSoFar,
  (state: TypedState) => state.config.username,
  (state: TypedState) => state.config.following,
  (
    searchResults: ?Array<User>,
    teamSoFar: I.Set<User>,
    myUsername: string,
    followingState: I.Set<string>
  ) => {
    return (searchResults || []).map(info => ({
      userId: info.id,
      username: info.id.split('@')[0],
      services: info.serviceMap,
      prettyName: info.prettyName,
      followingState: followStateHelperWithId(myUsername, followingState, info.id),
      inTeam: teamSoFar.some(u => u.id === info.id),
    }))
  }
)

// TODO test this
// Format the component is expecting, which is different than the normalized version in the store
const deriveTeamSoFarProp = memoizeOne((teamSoFar: I.Set<User>) =>
  teamSoFar.toArray().map(userInfo => {
    const {username, serviceId} = parseUserId(userInfo.id)
    return {
      userId: userInfo.id,
      prettyName: userInfo.prettyName,
      service: serviceId,
      username,
    }
  })
)

const deriveServiceResultCount = memoizeOne(() => ({}))
const deriveShowServiceResultCount = memoizeOne(() => false)

const deriveUserFromUserIdFn = memoizeOne((searchResults: ?Array<User>) => (userId: string): ?User =>
  (searchResults || []).filter(u => u.id === userId)[0] || null
)

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  return {
    userFromUserId: deriveUserFromUserIdFn(searchResultsSelector(state, ownProps)),
    searchResultsProp: searchResultsPropSelector(state, ownProps),
    teamSoFarProp: deriveTeamSoFarProp(state.chat2.teamBuildingTeamSoFar),
    // TODO
    serviceResultCount: deriveServiceResultCount(),
    showServiceResultCount: deriveShowServiceResultCount(),
  }
}

const mapDispatchToProps = dispatch => ({
  _onAdd: (user: User) => dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [user]})),
  onRemove: (userId: string) => dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({users: [userId]})),
  onFinishTeamBuilding: () => dispatch(TeamBuildingGen.createFinishedTeamBuilding()),
  _search: debounce((query: string, service: ServiceIdWithContact) => {
    dispatch(TeamBuildingGen.createSearch({query, service}))
  }, 500),
  _onCancelTeamBuilding: () => dispatch(TeamBuildingGen.createCancelTeamBuilding()),
})

const deriveOnBackspace = memoizeOne(
  <X>(
    searchString: ?string,
    teamSoFarProp: Array<{+userId: string} & X>,
    onRemove: (userId: string) => void
  ) => () => {
    // Check if empty and we have a team so far
    !searchString && teamSoFarProp.length && onRemove(teamSoFarProp[teamSoFarProp.length - 1].userId)
  }
)

const deriveOnEnterKeyDown = memoizeOne(
  <X, Y>(
    searchResultsProp: Array<{+userId: string} & X>,
    teamSoFarProp: Array<{+userId: string} & Y>,
    highlightedIndex: ?number,
    onAdd: (userId: string) => void,
    onRemove: (userId: string) => void
  ) => () => {
    if (searchResultsProp.length) {
      const selectedResult = searchResultsProp[highlightedIndex || 0]
      if (selectedResult) {
        if (teamSoFarProp.filter(u => u.userId === selectedResult.userId).length) {
          onRemove(selectedResult.userId)
        } else {
          onAdd(selectedResult.userId)
        }
      }
    }
  }
)

const deriveOnAdd = memoizeOne(
  (userFromUserId: (userId: string) => ?User, dispatchOnAdd: (user: User) => void, clearText: () => void) => (
    userId: string
  ) => {
    const user = userFromUserId(userId)
    if (!user) {
      logger.error(`Couldn't find User to add for ${userId}`)
      clearText()
      return
    }
    clearText()
    dispatchOnAdd(user)
  }
)

const deriveOnChangeText = memoizeOne(
  (
    onChangeText: (newText: string) => void,
    search: (text: string, service: ServiceIdWithContact) => void,
    selectedService: ServiceIdWithContact
  ) => (newText: string) => {
    onChangeText(newText)
    search(newText, selectedService)
  }
)

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {
    teamSoFarProp,
    searchResultsProp,
    userFromUserId,
    serviceResultCount,
    showServiceResultCount,
  } = stateProps

  const onChangeText = deriveOnChangeText(
    ownProps.onChangeText,
    dispatchProps._search,
    ownProps.selectedService
  )

  const onAdd = deriveOnAdd(userFromUserId, dispatchProps._onAdd, ownProps.incClearTextTrigger)

  const onEnterKeyDown = deriveOnEnterKeyDown(
    searchResultsProp,
    teamSoFarProp,
    ownProps.highlightedIndex,
    onAdd,
    dispatchProps.onRemove
  )

  return {
    clearTextTrigger: ownProps.clearTextTrigger,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd,
    onBackspace: deriveOnBackspace(ownProps.searchString, teamSoFarProp, dispatchProps.onRemove),
    onChangeService: ownProps.onChangeService,
    onChangeText,
    onClosePopup: dispatchProps._onCancelTeamBuilding,
    onDownArrowKeyDown: ownProps.onDownArrowKeyDown,
    onEnterKeyDown,
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onRemove: dispatchProps.onRemove,
    onUpArrowKeyDown: ownProps.onUpArrowKeyDown,
    searchResults: searchResultsProp,
    selectedService: ownProps.selectedService,
    serviceResultCount,
    showServiceResultCount,
    teamSoFar: teamSoFarProp,
  }
}

const Connected = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('TeamBuilding'),
  PopupDialogHoc
)(TeamBuilding)

class StateWrapperForTeamBuilding extends React.Component<{}, LocalState> {
  state: LocalState = initialState

  onChangeService = (selectedService: ServiceIdWithContact) => this.setState({selectedService})

  onChangeText = (newText: string) => this.setState({searchString: newText})

  onDownArrowKeyDown = () =>
    this.setState((state: LocalState) => ({
      highlightedIndex: state.highlightedIndex === null ? 0 : state.highlightedIndex + 1,
    }))

  onUpArrowKeyDown = () =>
    this.setState((state: LocalState) => ({
      highlightedIndex: !state.highlightedIndex ? 0 : state.highlightedIndex - 1,
    }))

  incClearTextTrigger = () =>
    this.setState((state: LocalState) => ({clearTextTrigger: state.clearTextTrigger + 1, searchString: ''}))

  render() {
    return (
      <Connected
        onChangeService={this.onChangeService}
        onChangeText={this.onChangeText}
        onDownArrowKeyDown={this.onDownArrowKeyDown}
        onUpArrowKeyDown={this.onUpArrowKeyDown}
        incClearTextTrigger={this.incClearTextTrigger}
        searchString={this.state.searchString}
        selectedService={this.state.selectedService}
        highlightedIndex={this.state.highlightedIndex}
        clearTextTrigger={this.state.clearTextTrigger}
      />
    )
  }
}

export default StateWrapperForTeamBuilding
