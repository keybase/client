import logger from '../logger'
import * as React from 'react'
import unidecode from 'unidecode'
import debounce from 'lodash/debounce'
import trim from 'lodash/trim'
import TeamBuilding, {
  RolePickerProps,
  SearchResult,
  SearchRecSection,
  numSectionLabel,
  Props as TeamBuildingProps,
} from '.'
import RolePickerHeaderAction from './role-picker-header-action'
import * as WaitingConstants from '../constants/waiting'
import * as ChatConstants from '../constants/chat2'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Container from '../util/container'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import * as Styles from '../styles'
import {requestIdleCallback} from '../util/idle-callback'
import {HeaderHoc, PopupDialogHoc, Button} from '../common-adapters'
import {memoizeShallow, memoize} from '../util/memoize'
import {TeamRoleType, MemberInfo, DisabledReasonsForRolePicker} from '../constants/types/teams'
import {getDisabledReasonsForRolePicker} from '../constants/teams'
import {nextRoleDown, nextRoleUp} from '../teams/role-picker'
import {Props as HeaderHocProps} from '../common-adapters/header-hoc/types'
import {HocExtractProps as PopupHocProps} from '../common-adapters/popup-dialog-hoc'
import {formatAnyPhoneNumbers} from '../util/phone-numbers'
import {isMobile} from '../constants/platform'

// TODO remove when bots are fully integrated in gui
type TeamRoleTypeWithoutBots = Exclude<TeamRoleType, 'bot' | 'restrictedbot'>
const filterRole = (r: TeamRoleType): TeamRoleTypeWithoutBots =>
  r === 'bot' || r === 'restrictedbot' ? 'reader' : r

type OwnProps = {
  filterServices?: Array<Types.ServiceIdWithContact>
  incFocusInputCounter: () => void
  focusInputCounter: number
  namespace: Types.AllowedNamespace
  teamname?: string
  searchString: string
  selectedService: Types.ServiceIdWithContact
  highlightedIndex: number
  onChangeText: (newText: string) => void
  onChangeService: (newService: Types.ServiceIdWithContact) => void
  incHighlightIndex: (maxIndex: number) => void
  decHighlightIndex: () => void
  resetHighlightIndex: (resetToHidden?: boolean) => void
  changeShowRolePicker: (showRolePicker: boolean) => void
  showRolePicker: boolean
  showServiceResultCount: boolean
  title: string
}

type LocalState = {
  focusInputCounter: number
  searchString: string
  selectedService: Types.ServiceIdWithContact
  highlightedIndex: number
  showRolePicker: boolean
}

const initialState: LocalState = {
  focusInputCounter: 0,
  highlightedIndex: 0,
  searchString: '',
  selectedService: 'keybase',
  showRolePicker: false,
}

const expensiveDeriveResults = (
  searchResults: Array<Types.User> | undefined,
  teamSoFar: Set<Types.User>,
  myUsername: string,
  followingState: Set<string>,
  preExistingTeamMembers: Map<string, MemberInfo>
) =>
  searchResults &&
  searchResults.map(info => {
    const label = info.label || ''
    return {
      contact: !!info.contact,
      displayLabel: formatAnyPhoneNumbers(label),
      followingState: Constants.followStateHelperWithId(myUsername, followingState, info.serviceMap.keybase),
      inTeam: [...teamSoFar].some(u => u.id === info.id),
      isPreExistingTeamMember: preExistingTeamMembers.has(info.id),
      isYou: info.username === myUsername,
      key: [info.id, info.prettyName, info.label, String(!!info.contact)].join('&'),
      prettyName: formatAnyPhoneNumbers(info.prettyName),
      services: info.serviceMap,
      userId: info.id,
      username: info.username,
    }
  })

const deriveSearchResults = memoize(expensiveDeriveResults)
const deriveRecommendation = memoize(expensiveDeriveResults)

const deriveTeamSoFar = memoize(
  (teamSoFar: Set<Types.User>): Array<Types.SelectedUser> =>
    [...teamSoFar].map(userInfo => {
      let username = ''
      let serviceId: Types.ServiceIdWithContact
      if (userInfo.contact && userInfo.serviceMap.keybase) {
        // resolved contact - pass username @ 'keybase' to teambox
        // so keybase avatar is rendered.
        username = userInfo.serviceMap.keybase
        serviceId = 'keybase'
      } else if (userInfo.serviceId !== 'keybase' && userInfo.serviceMap.keybase) {
        // Not a keybase result but has Keybase username. Id will be compound assertion,
        // but we want to display Keybase username and profile pic in teambox.
        username = userInfo.serviceMap.keybase
        serviceId = 'keybase'
      } else {
        username = userInfo.username
        serviceId = userInfo.serviceId
      }
      return {
        prettyName: userInfo.prettyName !== username ? userInfo.prettyName : '',
        service: serviceId,
        userId: userInfo.id,
        username,
      }
    })
)

const deriveServiceResultCount = memoize((searchResults: Types.SearchResults, query: string) =>
  [...(searchResults.get(trim(query)) ?? new Map<Types.ServiceIdWithContact, Array<Types.User>>()).entries()]
    .map(([key, results]) => [key, results.length])
    .reduce<Object>((o, [key, num]) => {
      o[key] = num
      return o
    }, {})
)

const deriveShowResults = memoize(searchString => !!searchString)

const deriveUserFromUserIdFn = memoize(
  (searchResults: Array<Types.User> | undefined, recommendations: Array<Types.User> | undefined) => (
    userId: string
  ): Types.User | null =>
    (searchResults || []).filter(u => u.id === userId)[0] ||
    (recommendations || []).filter(u => u.id === userId)[0] ||
    null
)

const emptyObj = {}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamBuildingState = state[ownProps.namespace].teamBuilding
  const teamBuildingSearchResults = teamBuildingState.searchResults
  const userResults: Array<Types.User> =
    teamBuildingState.searchResults.get(trim(ownProps.searchString))?.get(ownProps.selectedService) ?? []

  const preExistingTeamMembers =
    (ownProps.teamname && state.teams.teamNameToMembers.get(ownProps.teamname)) ||
    new Map<string, MemberInfo>()

  const disabledRoles = ownProps.teamname
    ? getDisabledReasonsForRolePicker(state, ownProps.teamname, null)
    : emptyObj

  const contactProps = {
    contactsImported: state.settings.contacts.importEnabled,
    contactsPermissionStatus: state.settings.contacts.permissionStatus,
    isImportPromptDismissed: state.settings.contacts.importPromptDismissed,
    numContactsImported: state.settings.contacts.importedCount,
  }

  return {
    ...contactProps,
    disabledRoles,
    recommendations: deriveRecommendation(
      teamBuildingState.userRecs,
      teamBuildingState.teamSoFar,
      state.config.username,
      state.config.following,
      preExistingTeamMembers
    ),
    searchResults: deriveSearchResults(
      userResults,
      teamBuildingState.teamSoFar,
      state.config.username,
      state.config.following,
      preExistingTeamMembers
    ),
    selectedRole: filterRole(teamBuildingState.selectedRole),
    sendNotification: teamBuildingState.sendNotification,
    serviceResultCount: deriveServiceResultCount(teamBuildingState.searchResults, ownProps.searchString),
    showResults: deriveShowResults(ownProps.searchString),
    showServiceResultCount: !isMobile && deriveShowResults(ownProps.searchString),
    teamBuildingSearchResults,
    teamSoFar: deriveTeamSoFar(teamBuildingState.teamSoFar),
    userFromUserId: deriveUserFromUserIdFn(userResults, teamBuildingState.userRecs),
    waitingForCreate: WaitingConstants.anyWaiting(state, ChatConstants.waitingKeyCreating),
  }
}

const makeDebouncedSearch = (time: number) =>
  debounce(
    (
      dispatch: Container.TypedDispatch,
      namespace: Types.AllowedNamespace,
      query: string,
      service: Types.ServiceIdWithContact,
      includeContacts: boolean,
      limit?: number
    ) =>
      requestIdleCallback(() =>
        dispatch(
          TeamBuildingGen.createSearch({
            includeContacts,
            limit,
            namespace,
            query,
            service,
          })
        )
      ),
    time
  )

const debouncedSearch = makeDebouncedSearch(500) // 500ms debounce on social searches
const debouncedSearchKeybase = makeDebouncedSearch(200) // 200 ms debounce on keybase searches

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {namespace, teamname}: OwnProps) => ({
  _onAdd: (user: Types.User) =>
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]})),
  _onCancelTeamBuilding: () => dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace})),
  _onImportContactsPermissionsGranted: () =>
    dispatch(SettingsGen.createEditContactImportEnabled({enable: true, fromSettings: false})),
  _onImportContactsPermissionsNotGranted: () =>
    dispatch(SettingsGen.createRequestContactPermissions({fromSettings: false, thenToggleImportOn: true})),
  _search: (query: string, service: Types.ServiceIdWithContact, limit?: number) => {
    const func = service === 'keybase' ? debouncedSearchKeybase : debouncedSearch
    return func(dispatch, namespace, query, service, namespace === 'chat2', limit)
  },
  fetchUserRecs: () =>
    dispatch(TeamBuildingGen.createFetchUserRecs({includeContacts: namespace === 'chat2', namespace})),
  onAskForContactsLater: () => dispatch(SettingsGen.createImportContactsLater()),
  onChangeSendNotification: (sendNotification: boolean) =>
    namespace === 'teams' &&
    dispatch(TeamBuildingGen.createChangeSendNotification({namespace, sendNotification})),
  onFinishTeamBuilding: () => dispatch(TeamBuildingGen.createFinishedTeamBuilding({namespace, teamname})),
  onLoadContactsSetting: () => dispatch(SettingsGen.createLoadContactImportEnabled()),
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
  (userFromUserId, dispatchOnAdd, changeText, resetHighlightIndex, incFocusInputCounter) => (
    userId: string
  ) => {
    const user = userFromUserId(userId)
    if (!user) {
      logger.error(`Couldn't find Types.User to add for ${userId}`)
      changeText('')
      return
    }
    changeText('')
    dispatchOnAdd(user)
    resetHighlightIndex(true)
    incFocusInputCounter()
  }
)

const deriveOnChangeText = memoize(
  (
    onChangeText: (newText: string) => void,
    search: (text: string, service: Types.ServiceIdWithContact) => void,
    selectedService: Types.ServiceIdWithContact,
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
    selectedRole: TeamRoleTypeWithoutBots,
    disabledRoles: DisabledReasonsForRolePicker,
    onSelectRole: (role: TeamRoleTypeWithoutBots) => void
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

const deriveOnChangeService = memoize(
  (
    onChangeService: OwnProps['onChangeService'],
    incFocusInputCounter: OwnProps['incFocusInputCounter'],
    search: (text: string, service: Types.ServiceIdWithContact) => void,
    searchString: string
  ) => (service: Types.ServiceIdWithContact) => {
    onChangeService(service)
    incFocusInputCounter()
    if (!Types.isContactServiceId(service)) {
      search(searchString, service)
    }
  }
)

const alphabet = 'abcdefghijklmnopqrstuvwxyz'
const aCharCode = alphabet.charCodeAt(0)
const alphaSet = new Set(alphabet)
const isAlpha = (letter: string) => alphaSet.has(letter)
const letterToAlphaIndex = (letter: string) => letter.charCodeAt(0) - aCharCode

// Returns array with 28 entries
// 0 - "Recommendations" section
// 1-26 - a-z sections
// 27 - 0-9 section
export const sortAndSplitRecommendations = memoize(
  (
    results: Unpacked<typeof deriveSearchResults>,
    showingContactsButton: boolean
  ): Array<SearchRecSection> | null => {
    if (!results) return null

    const sections: Array<SearchRecSection> = [
      ...(showingContactsButton
        ? [
            {
              data: [{isImportButton: true as const}],
              label: '',
              shortcut: false,
            },
          ]
        : []),

      {
        data: [],
        label: 'Recommendations',
        shortcut: false,
      },
    ]
    const recSectionIdx = sections.length - 1
    const numSectionIdx = recSectionIdx + 27
    results.forEach(rec => {
      if (!rec.contact) {
        sections[recSectionIdx].data.push(rec)
        return
      }
      if (rec.prettyName || rec.displayLabel) {
        // Use the first letter of the name we will display, but first normalize out
        // any diacritics.
        const decodedLetter = unidecode(rec.prettyName || rec.displayLabel)
        if (decodedLetter && decodedLetter[0]) {
          const letter = decodedLetter[0].toLowerCase()
          if (isAlpha(letter)) {
            // offset 1 to skip recommendations
            const sectionIdx = letterToAlphaIndex(letter) + recSectionIdx + 1
            if (!sections[sectionIdx]) {
              sections[sectionIdx] = {
                data: [],
                label: letter.toUpperCase(),
                shortcut: true,
              }
            }
            sections[sectionIdx].data.push(rec)
          } else {
            if (!sections[numSectionIdx]) {
              sections[numSectionIdx] = {
                data: [],
                label: numSectionLabel,
                shortcut: true,
              }
            }
            sections[numSectionIdx].data.push(rec)
          }
        }
      }
    })
    if (results.length < 5) {
      sections.push({
        data: [{isSearchHint: true as const}],
        label: '',
        shortcut: false,
      })
    }
    return sections.filter(s => s && s.data && s.data.length > 0)
  }
)

// Flatten list of recommendation sections. After recommendations are organized
// in sections, we also need a flat list of all recommendations to be able to
// know how many we have in total (including "fake" "import contacts" row), and
// which one is currently highlighted, to support keyboard events.
//
// Resulting list may have nulls in place of fake rows.
const flattenRecommendations = memoize((recommendations: Array<SearchRecSection>) => {
  const result: Array<SearchResult | null> = []
  for (const section of recommendations) {
    result.push(...section.data.map(rec => ('isImportButton' in rec || 'isSearchHint' in rec ? null : rec)))
  }
  return result
})

type TeamBuildingPropsPlusSome = TeamBuildingProps & {
  [key: string]: any
}
const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
): TeamBuildingPropsPlusSome => {
  const {
    teamSoFar,
    searchResults,
    userFromUserId,
    serviceResultCount,
    showServiceResultCount,
    recommendations,
    waitingForCreate,
  } = stateProps

  const showingContactsButton =
    Container.isMobile &&
    stateProps.contactsPermissionStatus !== 'never_ask_again' &&
    !stateProps.contactsImported

  // Contacts props
  const contactProps = {
    contactsImported: stateProps.contactsImported,
    contactsPermissionStatus: stateProps.contactsPermissionStatus,
    isImportPromptDismissed: stateProps.isImportPromptDismissed,
    numContactsImported: stateProps.numContactsImported || 0,
    onAskForContactsLater: dispatchProps.onAskForContactsLater,
    onImportContacts:
      stateProps.contactsPermissionStatus === 'never_ask_again'
        ? undefined
        : stateProps.contactsPermissionStatus === 'granted'
        ? dispatchProps._onImportContactsPermissionsGranted
        : dispatchProps._onImportContactsPermissionsNotGranted,
    onLoadContactsSetting: dispatchProps.onLoadContactsSetting,
  }

  const showRecs = !ownProps.searchString && !!recommendations && ownProps.selectedService === 'keybase'
  const recommendationsSections = showRecs
    ? sortAndSplitRecommendations(recommendations, showingContactsButton)
    : null
  const userResultsToShow = showRecs ? flattenRecommendations(recommendationsSections || []) : searchResults

  const onChangeText = deriveOnChangeText(
    ownProps.onChangeText,
    dispatchProps._search,
    ownProps.selectedService,
    ownProps.resetHighlightIndex
  )

  const onClear = () => onChangeText('')

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
    ownProps.resetHighlightIndex,
    ownProps.incFocusInputCounter
  )

  const rolePickerProps: RolePickerProps | undefined =
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
      : undefined

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

  const title = ownProps.title
  const headerHocProps: HeaderHocProps = Container.isMobile
    ? {
        borderless: true,
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
              : {
                  custom: (
                    <Button
                      label="Start"
                      mode="Primary"
                      onClick={dispatchProps.onFinishTeamBuilding}
                      small={true}
                      type="Success"
                    />
                  ),
                }
            : null,
        ],
        title,
      }
    : emptyObj

  const popupProps: PopupHocProps | null = Container.isMobile
    ? null
    : {
        closeStyleOverrides:
          ownProps.namespace === 'people'
            ? {
                display: 'none',
              }
            : null,
        containerStyleOverrides:
          ownProps.namespace === 'people'
            ? {
                width: '100%',
                ...Styles.padding(0, Styles.globalMargins.xsmall),
              }
            : null,
        coverStyleOverrides:
          ownProps.namespace === 'people'
            ? {
                alignItems: 'flex-start',
                backgroundColor: 'initial',
                ...Styles.padding(Styles.globalMargins.mediumLarge, 0, Styles.globalMargins.large),
              }
            : null,
        onClosePopup: dispatchProps._onCancelTeamBuilding,
        tabBarShim: true,
      }

  return {
    ...headerHocProps,
    ...popupProps,
    ...contactProps,
    fetchUserRecs: dispatchProps.fetchUserRecs,
    filterServices: ownProps.filterServices,
    focusInputCounter: ownProps.focusInputCounter,
    highlightedIndex: ownProps.highlightedIndex,
    includeContacts: ownProps.namespace === 'chat2',
    namespace: ownProps.namespace,
    onAdd,
    onBackspace: deriveOnBackspace(ownProps.searchString, teamSoFar, dispatchProps.onRemove),
    onChangeService: deriveOnChangeService(
      ownProps.onChangeService,
      ownProps.incFocusInputCounter,
      dispatchProps._search,
      ownProps.searchString
    ),
    onChangeText,
    onClear,
    onClose: dispatchProps._onCancelTeamBuilding,
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
    recommendations: recommendationsSections,
    rolePickerProps,
    search: dispatchProps._search,
    searchResults,
    searchString: ownProps.searchString,
    selectedService: ownProps.selectedService,
    serviceResultCount,
    showRecs,
    showResults: stateProps.showResults,
    showServiceResultCount: showServiceResultCount && ownProps.showServiceResultCount,
    teamBuildingSearchResults: stateProps.teamBuildingSearchResults,
    teamSoFar,
    teamname: ownProps.teamname,
    title,
    waitingForCreate,
  }
}

// TODO fix typing, remove compose
const Connected: React.ComponentType<OwnProps> = Container.compose(
  Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'TeamBuilding'),
  Container.isMobile ? HeaderHoc : PopupDialogHoc
)(TeamBuilding)

type RealOwnProps = Container.RouteProps<{
  namespace: Types.AllowedNamespace
  teamname?: string
  filterServices?: Array<Types.ServiceIdWithContact>
  title: string
}>

class StateWrapperForTeamBuilding extends React.Component<RealOwnProps, LocalState> {
  state: LocalState = initialState

  changeShowRolePicker = (showRolePicker: boolean) => this.setState({showRolePicker})

  onChangeService = (selectedService: Types.ServiceIdWithContact) => this.setState({selectedService})

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

  _incFocusInputCounter = () => this.setState(s => ({focusInputCounter: s.focusInputCounter + 1}))

  render() {
    return (
      <Connected
        namespace={Container.getRouteProps(this.props, 'namespace', 'chat2')}
        teamname={Container.getRouteProps(this.props, 'teamname', undefined)}
        filterServices={Container.getRouteProps(this.props, 'filterServices', undefined)}
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
        showServiceResultCount={false}
        focusInputCounter={this.state.focusInputCounter}
        incFocusInputCounter={this._incFocusInputCounter}
        title={Container.getRouteProps(this.props, 'title', '')}
      />
    )
  }
}

export default StateWrapperForTeamBuilding
