// @flow
import logger from '../logger'
import React from 'react'
import * as I from 'immutable'
import {debounce, trim} from 'lodash-es'
import TeamBuilding from '.'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {type TypedState, compose, connect, setDisplayName} from '../util/container'
import {PopupDialogHoc} from '../common-adapters'
import {parseUserId} from '../util/platforms'
import {followStateHelperWithId} from '../constants/team-building'
import memoizeOne from 'memoize-one'
import type {ServiceIdWithContact, User, SearchResults} from '../constants/types/team-building'

// TODO
// * there's a lot of render thrashing going on. using keyboard arrows is kinda slow becuase of it.
// * Limit the highlight index to the max lenght of the list

type OwnProps = {
  // Supplied by StateComponent
  searchString: string,
  selectedService: ServiceIdWithContact,
  highlightedIndex: ?number,
  onChangeText: (newText: string) => void,
  onChangeService: (newService: ServiceIdWithContact) => void,
  incHighlightIndex: (maxIndex: number) => void,
  decHighlightIndex: () => void,
}

type LocalState = {
  searchString: string,
  selectedService: ServiceIdWithContact,
  highlightedIndex: ?number,
}

const initialState: LocalState = {
  searchString: '',
  selectedService: 'keybase',
  highlightedIndex: 0,
}

const deriveSearchResults = memoizeOne(
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

const deriveTeamSoFar = memoizeOne((teamSoFar: I.Set<User>) =>
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

const deriveServiceResultCount: (
  searchResults: SearchResults,
  query: string
) => {[key: ServiceIdWithContact]: ?number} = memoizeOne((searchResults: SearchResults, query) =>
  // $FlowIssue toObject looses typing
  searchResults
    .get(trim(query), I.Map())
    .map(results => results.length)
    .toObject()
)

const deriveShowServiceResultCount = memoizeOne(searchString => !!searchString)

const deriveUserFromUserIdFn = memoizeOne((searchResults: ?Array<User>) => (userId: string): ?User =>
  (searchResults || []).filter(u => u.id === userId)[0] || null
)

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const userResults = state.chat2.teamBuildingSearchResults.getIn([
    trim(ownProps.searchString),
    ownProps.selectedService,
  ])

  return {
    userFromUserId: deriveUserFromUserIdFn(userResults),
    searchResults: deriveSearchResults(
      userResults,
      state.chat2.teamBuildingTeamSoFar,
      state.config.username,
      state.config.following
    ),
    teamSoFar: deriveTeamSoFar(state.chat2.teamBuildingTeamSoFar),
    serviceResultCount: deriveServiceResultCount(
      state.chat2.teamBuildingSearchResults,
      ownProps.searchString
    ),
    showServiceResultCount: deriveShowServiceResultCount(ownProps.searchString),
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
    teamSoFar: Array<{+userId: string} & X>,
    onRemove: (userId: string) => void
  ) => () => {
    // Check if empty and we have a team so far
    !searchString && teamSoFar.length && onRemove(teamSoFar[teamSoFar.length - 1].userId)
  }
)

const deriveOnEnterKeyDown = memoizeOne(
  <X, Y>(
    searchResults: Array<{+userId: string} & X>,
    teamSoFar: Array<{+userId: string} & Y>,
    highlightedIndex: ?number,
    onAdd: (userId: string) => void,
    onRemove: (userId: string) => void,
    changeText: (newText: string) => void
  ) => () => {
    if (searchResults.length) {
      const selectedResult = searchResults[highlightedIndex || 0]
      if (selectedResult) {
        if (teamSoFar.filter(u => u.userId === selectedResult.userId).length) {
          onRemove(selectedResult.userId)
          changeText('')
        } else {
          onAdd(selectedResult.userId)
        }
      }
    }
  }
)

const deriveOnAdd = memoizeOne(
  (
    userFromUserId: (userId: string) => ?User,
    dispatchOnAdd: (user: User) => void,
    changeText: string => void
  ) => (userId: string) => {
    const user = userFromUserId(userId)
    if (!user) {
      logger.error(`Couldn't find User to add for ${userId}`)
      changeText('')
      return
    }
    changeText('')
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

const deriveOnDownArrowKeyDown = memoizeOne(
  (maxIndex: number, incHighlightIndex: (maxIndex: number) => void) => () => incHighlightIndex(maxIndex)
)

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {teamSoFar, searchResults, userFromUserId, serviceResultCount, showServiceResultCount} = stateProps

  const onChangeText = deriveOnChangeText(
    ownProps.onChangeText,
    dispatchProps._search,
    ownProps.selectedService
  )

  const onAdd = deriveOnAdd(userFromUserId, dispatchProps._onAdd, ownProps.onChangeText)

  const onEnterKeyDown = deriveOnEnterKeyDown(
    searchResults,
    teamSoFar,
    ownProps.highlightedIndex,
    onAdd,
    dispatchProps.onRemove,
    ownProps.onChangeText
  )

  return {
    highlightedIndex: ownProps.highlightedIndex,
    onAdd,
    searchString: ownProps.searchString,
    onBackspace: deriveOnBackspace(ownProps.searchString, teamSoFar, dispatchProps.onRemove),
    onChangeService: ownProps.onChangeService,
    onChangeText,
    onClosePopup: dispatchProps._onCancelTeamBuilding,
    onDownArrowKeyDown: deriveOnDownArrowKeyDown(searchResults.length - 1, ownProps.incHighlightIndex),
    onEnterKeyDown,
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onRemove: dispatchProps.onRemove,
    onUpArrowKeyDown: ownProps.decHighlightIndex,
    searchResults,
    selectedService: ownProps.selectedService,
    serviceResultCount,
    showServiceResultCount,
    teamSoFar,
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

  incHighlightIndex = (maxIndex: number) =>
    this.setState((state: LocalState) => ({
      highlightedIndex: Math.min(state.highlightedIndex === null ? 0 : state.highlightedIndex + 1, maxIndex),
    }))

  decHighlightIndex = () =>
    this.setState((state: LocalState) => ({
      highlightedIndex: !state.highlightedIndex ? 0 : state.highlightedIndex - 1,
    }))

  render() {
    return (
      <Connected
        onChangeService={this.onChangeService}
        onChangeText={this.onChangeText}
        incHighlightIndex={this.incHighlightIndex}
        decHighlightIndex={this.decHighlightIndex}
        searchString={this.state.searchString}
        selectedService={this.state.selectedService}
        highlightedIndex={this.state.highlightedIndex}
      />
    )
  }
}

export default StateWrapperForTeamBuilding
