// @flow
import logger from '../logger'
import React from 'react'
import * as I from 'immutable'
import {debounce, trim} from 'lodash-es'
import TeamBuilding from '.'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {compose, namedConnect} from '../util/container'
import {PopupDialogHoc} from '../common-adapters'
import {parseUserId} from '../util/platforms'
import {followStateHelperWithId} from '../constants/team-building'
import {memoize1Shallow, memoize1, memoize2, memoize3, memoize4} from '../util/memoize'
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
  highlightedIndex: 0,
  searchString: '',
  selectedService: 'keybase',
}

const deriveSearchResults = memoize4(
  (
    searchResults: ?Array<User>,
    teamSoFar: I.Set<User>,
    myUsername: string,
    followingState: I.Set<string>
  ) => {
    return (searchResults || []).map(info => ({
      followingState: followStateHelperWithId(myUsername, followingState, info.id),
      inTeam: teamSoFar.some(u => u.id === info.id),
      prettyName: info.prettyName,
      services: info.serviceMap,
      userId: info.id,
      username: info.id.split('@')[0],
    }))
  }
)

const deriveTeamSoFar = memoize1((teamSoFar: I.Set<User>) =>
  teamSoFar.toArray().map(userInfo => {
    const {username, serviceId} = parseUserId(userInfo.id)
    return {
      prettyName: userInfo.prettyName,
      service: serviceId,
      userId: userInfo.id,
      username,
    }
  })
)

const deriveServiceResultCount: (
  searchResults: SearchResults,
  query: string
) => {[key: ServiceIdWithContact]: ?number} = memoize1((searchResults: SearchResults, query) =>
  // $FlowIssue toObject looses typing
  searchResults
    .get(trim(query), I.Map())
    .map(results => results.length)
    .toObject()
)

const deriveShowServiceResultCount = memoize1(searchString => !!searchString)

const deriveUserFromUserIdFn = memoize1((searchResults: ?Array<User>) => (userId: string): ?User =>
  (searchResults || []).filter(u => u.id === userId)[0] || null
)

const mapStateToProps = (state, ownProps: OwnProps) => {
  const userResults = state.chat2.teamBuildingSearchResults.getIn([
    trim(ownProps.searchString),
    ownProps.selectedService,
  ])

  return {
    recommendations: deriveSearchResults(
      state.chat2.teamBuildingUserRecs,
      state.chat2.teamBuildingTeamSoFar,
      state.config.username,
      state.config.following
    ),
    searchResults: deriveSearchResults(
      userResults,
      state.chat2.teamBuildingTeamSoFar,
      state.config.username,
      state.config.following
    ),
    serviceResultCount: deriveServiceResultCount(
      state.chat2.teamBuildingSearchResults,
      ownProps.searchString
    ),
    showServiceResultCount: deriveShowServiceResultCount(ownProps.searchString),
    teamSoFar: deriveTeamSoFar(state.chat2.teamBuildingTeamSoFar),
    userFromUserId: deriveUserFromUserIdFn(userResults),
  }
}

const mapDispatchToProps = dispatch => ({
  _onAdd: (user: User) => dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({users: [user]})),
  _onCancelTeamBuilding: () => dispatch(TeamBuildingGen.createCancelTeamBuilding()),
  _search: debounce((query: string, service: ServiceIdWithContact) => {
    dispatch(TeamBuildingGen.createSearch({query, service}))
  }, 500),
  fetchUserRecs: () => dispatch(TeamBuildingGen.createFetchUserRecs()),
  onFinishTeamBuilding: () => dispatch(TeamBuildingGen.createFinishedTeamBuilding()),
  onRemove: (userId: string) => dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({users: [userId]})),
})

const deriveOnBackspace = memoize3((searchString, teamSoFar, onRemove) => () => {
  // Check if empty and we have a team so far
  !searchString && teamSoFar.length && onRemove(teamSoFar[teamSoFar.length - 1].userId)
})

const deriveOnEnterKeyDown = memoize1Shallow(
  ({
    searchResults,
    teamSoFar,
    highlightedIndex,
    onAdd,
    onRemove,
    changeText,
    searchStringIsEmpty,
    onFinishTeamBuilding,
  }) => () => {
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
    } else if (searchStringIsEmpty && !!teamSoFar.length) {
      // They hit enter with an empty search string and a teamSoFar
      // We'll Finish the team building
      onFinishTeamBuilding()
    }
  }
)

const deriveOnAdd = memoize3((userFromUserId, dispatchOnAdd, changeText) => (userId: string) => {
  const user = userFromUserId(userId)
  if (!user) {
    logger.error(`Couldn't find User to add for ${userId}`)
    changeText('')
    return
  }
  changeText('')
  dispatchOnAdd(user)
})

const deriveOnChangeText = memoize3(
  (
    onChangeText: (newText: string) => void,
    search: (text: string, service: ServiceIdWithContact) => void,
    selectedService: ServiceIdWithContact
  ) => (newText: string) => {
    onChangeText(newText)
    search(newText, selectedService)
  }
)

const deriveOnDownArrowKeyDown = memoize2(
  (maxIndex: number, incHighlightIndex: (maxIndex: number) => void) => () => incHighlightIndex(maxIndex)
)

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {
    teamSoFar,
    searchResults,
    userFromUserId,
    serviceResultCount,
    showServiceResultCount,
    recommendations,
  } = stateProps

  const onChangeText = deriveOnChangeText(
    ownProps.onChangeText,
    dispatchProps._search,
    ownProps.selectedService
  )

  const onAdd = deriveOnAdd(userFromUserId, dispatchProps._onAdd, ownProps.onChangeText)

  const onEnterKeyDown = deriveOnEnterKeyDown({
    changeText: ownProps.onChangeText,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd,
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onRemove: dispatchProps.onRemove,
    searchResults,
    searchStringIsEmpty: !ownProps.searchString,
    teamSoFar,
  })

  return {
    fetchUserRecs: dispatchProps.fetchUserRecs,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd,
    onBackspace: deriveOnBackspace(ownProps.searchString, teamSoFar, dispatchProps.onRemove),
    onChangeService: ownProps.onChangeService,
    onChangeText,
    onClosePopup: dispatchProps._onCancelTeamBuilding,
    onDownArrowKeyDown: deriveOnDownArrowKeyDown(searchResults.length - 1, ownProps.incHighlightIndex),
    onEnterKeyDown,
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onMakeItATeam: () => console.log('todo'),
    onRemove: dispatchProps.onRemove,
    onUpArrowKeyDown: ownProps.decHighlightIndex,
    recommendations,
    searchResults,
    searchString: ownProps.searchString,
    selectedService: ownProps.selectedService,
    serviceResultCount,
    showServiceResultCount,
    teamSoFar,
  }
}

const Connected = compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'TeamBuilding'),
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
