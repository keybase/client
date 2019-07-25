import logger from '../logger'
import * as React from 'react'
import * as I from 'immutable'
import {debounce, trim} from 'lodash-es'
import TeamBuilding, {RolePickerProps} from '.'
import RolePickerHeaderAction from './role-picker-header-action'
import * as WaitingConstants from '../constants/waiting'
import * as ChatConstants from '../constants/chat2'
import * as TeamBuildingGen from '../actions/team-building-gen'
import {compose, namedConnect, TypedState, TypedDispatch} from '../util/container'
import {requestIdleCallback} from '../util/idle-callback'
import {HeaderHoc, PopupDialogHoc} from '../common-adapters'
import {isMobile} from '../constants/platform'
import {parseUserId} from '../util/platforms'
import {followStateHelperWithId} from '../constants/team-building'
import {memoizeShallow, memoize} from '../util/memoize'
import {ServiceIdWithContact, User, SearchResults, AllowedNamespace} from '../constants/types/team-building'
import {TeamRoleType, MemberInfo, DisabledReasonsForRolePicker} from '../constants/types/teams'
import {getDisabledReasonsForRolePicker} from '../constants/teams'
import {nextRoleDown, nextRoleUp} from '../teams/role-picker'
import {Props as HeaderHocProps} from '../common-adapters/header-hoc/types'
import {RouteProps} from '../route-tree/render-route'

type OwnProps = {
  namespace: AllowedNamespace
  teamname?: string
  searchString: string
  selectedService: ServiceIdWithContact
  highlightedIndex: number
  onChangeText: (newText: string) => void
  onChangeService: (newService: ServiceIdWithContact) => void
  incHighlightIndex: (maxIndex: number) => void
  decHighlightIndex: () => void
  resetHighlightIndex: (resetToHidden?: boolean) => void
  changeShowRolePicker: (showRolePicker: boolean) => void
  showRolePicker: boolean
}

type LocalState = {
  searchString: string
  selectedService: ServiceIdWithContact
  highlightedIndex: number
  showRolePicker: boolean
}

const initialState: LocalState = {
  highlightedIndex: 0,
  searchString: '',
  selectedService: 'keybase',
  showRolePicker: false,
}

const deriveSearchResults = memoize(
  (
    searchResults: Array<User> | null,
    teamSoFar: I.Set<User>,
    myUsername: string,
    followingState: I.Set<string>,
    preExistingTeamMembers: I.Map<string, MemberInfo>
  ) =>
    searchResults &&
    searchResults.map(info => ({
      displayLabel: info.label || '',
      followingState: followStateHelperWithId(myUsername, followingState, info.serviceMap.keybase),
      inTeam: teamSoFar.some(u => u.id === info.id),
      isPreExistingTeamMember: preExistingTeamMembers.has(info.id),
      key: [info.id, info.prettyName, info.label].join('&'),
      prettyName: info.prettyName,
      services: info.serviceMap,
      userId: info.id,
      username: info.id.split('@')[0],
    }))
)

const deriveTeamSoFar = memoize((teamSoFar: I.Set<User>) =>
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
) => {[K in ServiceIdWithContact]: number | null} = memoize((searchResults: SearchResults, query) =>
  // @ts-ignore codemod issue
  searchResults
    .get(trim(query), I.Map())
    .map(results => results.length)
    .toObject()
)

const deriveShowServiceResultCount = memoize(searchString => !!searchString)

const deriveUserFromUserIdFn = memoize(
  (searchResults: Array<User> | null, recommendations: Array<User> | null) => (userId: string): User | null =>
    (searchResults || []).filter(u => u.id === userId)[0] ||
    (recommendations || []).filter(u => u.id === userId)[0] ||
    null
)

const emptyObj = {}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const teamBuildingState = state[ownProps.namespace].teamBuilding
  const userResults = teamBuildingState.teamBuildingSearchResults.getIn([
    trim(ownProps.searchString),
    ownProps.selectedService,
  ])

  const preExistingTeamMembers: I.Map<string, MemberInfo> = ownProps.teamname
    ? state.teams.teamNameToMembers.get(ownProps.teamname) || I.Map()
    : I.Map()

  const disabledRoles = ownProps.teamname
    ? getDisabledReasonsForRolePicker(state, ownProps.teamname, null)
    : emptyObj

  return {
    disabledRoles,
    recommendations: deriveSearchResults(
      teamBuildingState.teamBuildingUserRecs,
      teamBuildingState.teamBuildingTeamSoFar,
      state.config.username,
      state.config.following,
      preExistingTeamMembers
    ),
    searchResults: deriveSearchResults(
      userResults,
      teamBuildingState.teamBuildingTeamSoFar,
      state.config.username,
      state.config.following,
      preExistingTeamMembers
    ),
    selectedRole: teamBuildingState.teamBuildingSelectedRole,
    sendNotification: teamBuildingState.teamBuildingSendNotification,
    serviceResultCount: deriveServiceResultCount(
      teamBuildingState.teamBuildingSearchResults,
      ownProps.searchString
    ),
    showServiceResultCount: deriveShowServiceResultCount(ownProps.searchString),
    teamSoFar: deriveTeamSoFar(teamBuildingState.teamBuildingTeamSoFar),
    userFromUserId: deriveUserFromUserIdFn(userResults, teamBuildingState.teamBuildingUserRecs),
    waitingForCreate: WaitingConstants.anyWaiting(state, ChatConstants.waitingKeyCreating),
  }
}

const debouncedSearch = debounce(
  (
    dispatch: TypedDispatch,
    namespace: AllowedNamespace,
    query: string,
    service: ServiceIdWithContact,
    limit?: number
  ) =>
    requestIdleCallback(() =>
      dispatch(
        TeamBuildingGen.createSearch({
          limit,
          namespace,
          query,
          service,
        })
      )
    ),
  1000
)

const mapDispatchToProps = (dispatch: TypedDispatch, {namespace, teamname}: OwnProps) => ({
  _onAdd: (user: User) => dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]})),
  _onCancelTeamBuilding: () => dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace})),
  _search: (query: string, service: ServiceIdWithContact, limit?: number) =>
    debouncedSearch(dispatch, namespace, query, service, limit),
  fetchUserRecs: () => dispatch(TeamBuildingGen.createFetchUserRecs({namespace})),
  onChangeSendNotification: (sendNotification: boolean) =>
    namespace === 'teams' &&
    dispatch(TeamBuildingGen.createChangeSendNotification({namespace, sendNotification})),
  onFinishTeamBuilding: () => dispatch(TeamBuildingGen.createFinishedTeamBuilding({namespace, teamname})),
  onRemove: (userId: string) =>
    dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({namespace, users: [userId]})),
  onSelectRole: (role: TeamRoleType) =>
    namespace === 'teams' && dispatch(TeamBuildingGen.createSelectRole({namespace, role})),
})

const deriveOnBackspace = memoize((searchString, teamSoFar, onRemove) => () => {
  // Check if empty and we have a team so far
  !searchString && teamSoFar.length && onRemove(teamSoFar[teamSoFar.length - 1].userId)
})

const deriveOnEnterKeyDown = memoizeShallow(
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
    const selectedResult = !!searchResults && searchResults[highlightedIndex]
    if (selectedResult) {
      // We don't handle cases where they hit enter on someone that is already a
      // team member
      if (selectedResult.isPreExistingTeamMember) {
        return
      }
      if (teamSoFar.filter(u => u.userId === selectedResult.userId).length) {
        onRemove(selectedResult.userId)
        changeText('')
      } else {
        onAdd(selectedResult.userId)
      }
    } else if (searchStringIsEmpty && !!teamSoFar.length) {
      // They hit enter with an empty search string and a teamSoFar
      // We'll Finish the team building
      onFinishTeamBuilding()
    }
  }
)

const deriveOnSearchForMore = memoizeShallow(
  ({search, searchResults, searchString, selectedService}) => () => {
    if (searchResults && searchResults.length >= 10) {
      search(searchString, selectedService, searchResults.length + 20)
    }
  }
)

const deriveOnAdd = memoize(
  (userFromUserId, dispatchOnAdd, changeText, resetHighlightIndex) => (userId: string) => {
    const user = userFromUserId(userId)
    if (!user) {
      logger.error(`Couldn't find User to add for ${userId}`)
      changeText('')
      return
    }
    changeText('')
    dispatchOnAdd(user)
    resetHighlightIndex(true)
  }
)

const deriveOnChangeText = memoize(
  (
    onChangeText: (newText: string) => void,
    search: (text: string, service: ServiceIdWithContact) => void,
    selectedService: ServiceIdWithContact,
    resetHighlightIndex: Function
  ) => (newText: string) => {
    onChangeText(newText)
    search(newText, selectedService)
    resetHighlightIndex()
  }
)

const deriveOnDownArrowKeyDown = memoize(
  (maxIndex: number, incHighlightIndex: (maxIndex: number) => void) => () => incHighlightIndex(maxIndex)
)

const deriveRolePickerArrowKeyFns = memoize(
  (
    selectedRole: TeamRoleType,
    disabledRoles: DisabledReasonsForRolePicker,
    onSelectRole: (role: TeamRoleType) => void
  ) => ({
    downArrow: () => {
      const nextRole = nextRoleDown(selectedRole)
      if (!disabledRoles[nextRole]) {
        onSelectRole(nextRole)
      }
    },
    upArrow: () => {
      const nextRole = nextRoleUp(selectedRole)
      if (!disabledRoles[nextRole]) {
        onSelectRole(nextRole)
      }
    },
  })
)

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => {
  const {
    teamSoFar,
    searchResults,
    userFromUserId,
    serviceResultCount,
    showServiceResultCount,
    recommendations,
    waitingForCreate,
  } = stateProps

  const showRecs = !ownProps.searchString && !!recommendations && ownProps.selectedService === 'keybase'
  const userResultsToShow = showRecs ? recommendations : searchResults

  const onChangeText = deriveOnChangeText(
    ownProps.onChangeText,
    dispatchProps._search,
    ownProps.selectedService,
    ownProps.resetHighlightIndex
  )

  const onSearchForMore = deriveOnSearchForMore({
    search: dispatchProps._search,
    searchResults,
    searchString: ownProps.searchString,
    selectedService: ownProps.selectedService,
  })

  const onAdd = deriveOnAdd(
    userFromUserId,
    dispatchProps._onAdd,
    ownProps.onChangeText,
    ownProps.resetHighlightIndex
  )

  const rolePickerProps: RolePickerProps | null =
    ownProps.namespace === 'teams'
      ? {
          changeSendNotification: dispatchProps.onChangeSendNotification,
          changeShowRolePicker: ownProps.changeShowRolePicker,
          disabledRoles: stateProps.disabledRoles,
          onSelectRole: dispatchProps.onSelectRole,
          selectedRole: stateProps.selectedRole,
          sendNotification: stateProps.sendNotification,
          showRolePicker: ownProps.showRolePicker,
        }
      : null

  // TODO this should likely live with the role picker if we need this
  // functionality elsewhere. Right now it's easier to keep here since the input
  // already catches all keypresses
  const rolePickerArrowKeyFns =
    ownProps.showRolePicker &&
    deriveRolePickerArrowKeyFns(stateProps.selectedRole, stateProps.disabledRoles, dispatchProps.onSelectRole)

  const onEnterKeyDown = deriveOnEnterKeyDown({
    changeText: ownProps.onChangeText,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd,
    onFinishTeamBuilding:
      rolePickerProps && !ownProps.showRolePicker
        ? () => ownProps.changeShowRolePicker(true)
        : dispatchProps.onFinishTeamBuilding,
    onRemove: dispatchProps.onRemove,
    searchResults: userResultsToShow,
    searchStringIsEmpty: !ownProps.searchString,
    teamSoFar,
  })

  const headerHocProps: HeaderHocProps = isMobile
    ? {
        leftAction: 'cancel',
        onLeftAction: dispatchProps._onCancelTeamBuilding,
        rightActions: [
          teamSoFar.length
            ? rolePickerProps
              ? {
                  custom: (
                    <RolePickerHeaderAction
                      onFinishTeamBuilding={dispatchProps.onFinishTeamBuilding}
                      rolePickerProps={rolePickerProps}
                      count={teamSoFar.length}
                    />
                  ),
                }
              : {label: 'Start', onPress: dispatchProps.onFinishTeamBuilding}
            : null,
        ],
        title: rolePickerProps ? 'Add people' : 'New chat',
      }
    : {}

  return {
    ...headerHocProps,
    fetchUserRecs: dispatchProps.fetchUserRecs,
    highlightedIndex: ownProps.highlightedIndex,
    onAdd,
    onBackspace: deriveOnBackspace(ownProps.searchString, teamSoFar, dispatchProps.onRemove),
    onChangeService: ownProps.onChangeService,
    onChangeText,
    onClosePopup: dispatchProps._onCancelTeamBuilding,
    onDownArrowKeyDown:
      ownProps.showRolePicker && rolePickerArrowKeyFns
        ? rolePickerArrowKeyFns.downArrow
        : deriveOnDownArrowKeyDown((userResultsToShow || []).length - 1, ownProps.incHighlightIndex),
    onEnterKeyDown,
    onFinishTeamBuilding: dispatchProps.onFinishTeamBuilding,
    onMakeItATeam: () => console.log('todo'),
    onRemove: dispatchProps.onRemove,
    onSearchForMore,
    onUpArrowKeyDown:
      ownProps.showRolePicker && rolePickerArrowKeyFns
        ? rolePickerArrowKeyFns.upArrow
        : ownProps.decHighlightIndex,
    recommendations,
    rolePickerProps,
    searchResults,
    searchString: ownProps.searchString,
    selectedService: ownProps.selectedService,
    serviceResultCount,
    showRecs,
    showServiceResultCount,
    teamSoFar,
    waitingForCreate,
  }
}

// TODO fix typing, remove compose
const Connected: React.ComponentType<OwnProps> = compose(
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'TeamBuilding'),
  isMobile ? HeaderHoc : PopupDialogHoc
)(TeamBuilding)

class StateWrapperForTeamBuilding extends React.Component<RouteProps, LocalState> {
  state: LocalState = initialState

  changeShowRolePicker = (showRolePicker: boolean) => this.setState({showRolePicker})

  onChangeService = (selectedService: ServiceIdWithContact) => this.setState({selectedService})

  onChangeText = (newText: string) => {
    if (newText !== this.state.searchString) {
      this.setState({searchString: newText, showRolePicker: false})
    }
  }

  incHighlightIndex = (maxIndex: number) =>
    this.setState((state: LocalState) => ({
      highlightedIndex: Math.min(state.highlightedIndex + 1, maxIndex),
    }))

  decHighlightIndex = () =>
    this.setState((state: LocalState) => ({
      highlightedIndex: state.highlightedIndex < 1 ? 0 : state.highlightedIndex - 1,
    }))

  resetHighlightIndex = (resetToHidden?: boolean) =>
    this.setState({highlightedIndex: resetToHidden ? -1 : initialState.highlightedIndex})

  render() {
    return (
      <Connected
        namespace={this.props.navigation.getParam('namespace')}
        teamname={this.props.navigation.getParam('teamname') || null}
        onChangeService={this.onChangeService}
        onChangeText={this.onChangeText}
        incHighlightIndex={this.incHighlightIndex}
        decHighlightIndex={this.decHighlightIndex}
        resetHighlightIndex={this.resetHighlightIndex}
        searchString={this.state.searchString}
        selectedService={this.state.selectedService}
        highlightedIndex={this.state.highlightedIndex}
        changeShowRolePicker={this.changeShowRolePicker}
        showRolePicker={this.state.showRolePicker}
      />
    )
  }
}

export default StateWrapperForTeamBuilding
