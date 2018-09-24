// @flow
import logger from '../logger'
import React from 'react'
import * as I from 'immutable'
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
      inTeam: teamSoFar.has(info),
    }))
  }
)

const teamSoFarPropSelector = createSelector(
  (state: TypedState) => state.chat2.teamBuildingTeamSoFar,
  (teamSoFar: I.Set<User>) =>
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

// TODO test this
// Format the component is expecting, which is different than the normalized version in the store
const deriveTeamSoFarProp = (teamSoFar: Set<User>) =>
  teamSoFar.toArray().map(userInfo => {
    const {username, serviceId} = parseUserId(userInfo.id)
    return {
      userId: userInfo.id,
      prettyName: userInfo.prettyName,
      service: serviceId,
      username,
    }
  })

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  return {
    searchResults: searchResultsSelector(state, ownProps),
    searchResultsProp: searchResultsPropSelector(state, ownProps),
    teamSoFarProp: deriveTeamSoFarProp(state.chat2.teamBuildingTeamSoFar),
  }
}

const mapDispatchToProps = dispatch => ({
  _onAdd: (user: User) => dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [user]})),
  onRemove: (userId: string) => dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({users: [userId]})),
  onFinishTeamBuilding: () => dispatch(TeamBuildingGen.createFinishedTeamBuilding()),
  _search: (query: string, service: ServiceIdWithContact) => {
    dispatch(TeamBuildingGen.createSearch({query, service}))
  },
  _onCancelTeamBuilding: () => dispatch(TeamBuildingGen.createCancelTeamBuilding()),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {teamSoFarProp, searchResultsProp, searchResults} = stateProps

  const onChangeText = (newText: string) => {
    ownProps.onChangeText(newText)
    dispatchProps._search(newText, ownProps.selectedService)
  }

  const onAdd = (userId: string) => {
    if (searchResults) {
      const user = searchResults.filter(u => u.id === userId)[0]
      if (!user) {
        logger.error(`Couldn't find User to add for ${userId}`)
      }
      ownProps.incClearTextTrigger()
      dispatchProps._onAdd(user)
    }
  }

  const onEnterKeyDown = () => {
    if (searchResultsProp.length) {
      const selectedResult = searchResultsProp[ownProps.highlightedIndex || 0]
      if (selectedResult) {
        onAdd(selectedResult.userId)
      }
    }
  }

  return {
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onChangeText,
    onEnterKeyDown,
    onDownArrowKeyDown: ownProps.onDownArrowKeyDown,
    onUpArrowKeyDown: ownProps.onUpArrowKeyDown,
    teamSoFar: teamSoFarProp,
    onRemove: dispatchProps.onRemove,
    onBackspace: () => {
      // Check if empty and we have a team so far
      !ownProps.searchString &&
        teamSoFarProp.length &&
        dispatchProps.onRemove(teamSoFarProp[teamSoFarProp.length - 1].userId)
    },
    selectedService: ownProps.selectedService,
    onChangeService: ownProps.onChangeService,
    serviceResultCount: {}, // TODO
    showServiceResultCount: false, // TODO
    searchResults: searchResultsProp,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd,
    clearTextTrigger: ownProps.clearTextTrigger,
    onClosePopup: dispatchProps._onCancelTeamBuilding,
  }
}

const Connected = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  PopupDialogHoc,
  setDisplayName('TeamBuilding')
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
