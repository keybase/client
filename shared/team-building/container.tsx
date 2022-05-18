import logger from '../logger'
import * as React from 'react'
import debounce from 'lodash/debounce'
import trim from 'lodash/trim'
import TeamBuilding from '.'
import type {SearchResult, SearchRecSection} from './types'
import {numSectionLabel} from './recs-and-recos'
import * as WaitingConstants from '../constants/waiting'
import * as ChatConstants from '../constants/chat2'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as Container from '../util/container'
import * as Constants from '../constants/team-building'
import * as Types from '../constants/types/team-building'
import type * as TeamTypes from '../constants/types/teams'
import {requestIdleCallback} from '../util/idle-callback'
import {memoize} from '../util/memoize'
import {getTeamDetails, getTeamMeta} from '../constants/teams'
import {formatAnyPhoneNumbers} from '../util/phone-numbers'
import {isMobile} from '../constants/platform'
import {useRoute} from '@react-navigation/native'

const expensiveDeriveResults = (
  searchResults: Array<Types.User> | undefined,
  teamSoFar: Set<Types.User>,
  myUsername: string,
  followingState: Set<string>,
  preExistingTeamMembers: Map<string, TeamTypes.MemberInfo>
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
      pictureUrl: info.pictureUrl,
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
        pictureUrl: userInfo.pictureUrl,
        prettyName: userInfo.prettyName !== username ? userInfo.prettyName : '',
        service: serviceId,
        userId: userInfo.id,
        username,
      }
    })
)

const _deriveServiceResultCount = memoize((searchResults: Types.SearchResults, query: string) =>
  [...(searchResults.get(trim(query)) ?? new Map<Types.ServiceIdWithContact, Array<Types.User>>()).entries()]
    .map(([key, results]) => [key, results.length] as const)
    .reduce<{[k: string]: number}>((o, [key, num]) => {
      o[key] = num
      return o
    }, {})
)
const emptyObject = {}
const deriveServiceResultCount = (searchResults: Types.SearchResults, query: string) => {
  const val = _deriveServiceResultCount(searchResults, query)
  if (Object.keys(val)) {
    return val
  }
  return emptyObject
}

const deriveUserFromUserIdFn = memoize(
  (searchResults: Array<Types.User> | undefined, recommendations: Array<Types.User> | undefined) =>
    (userId: string): Types.User | null =>
      (searchResults || []).filter(u => u.id === userId)[0] ||
      (recommendations || []).filter(u => u.id === userId)[0] ||
      null
)

const emptyMap = new Map()

const deriveOnChangeText = memoize(
  (
      onChangeText: (newText: string) => void,
      search: (text: string, service: Types.ServiceIdWithContact) => void,
      selectedService: Types.ServiceIdWithContact,
      resetHighlightIndex: Function
    ) =>
    (newText: string) => {
      onChangeText(newText)
      search(newText, selectedService)
      resetHighlightIndex()
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
        const decodedLetter = /*unidecode*/ rec.prettyName || rec.displayLabel
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

const makeDebouncedSearch = (time: number) =>
  debounce(
    (
      dispatch: Container.TypedDispatch,
      namespace: Types.AllowedNamespace,
      query: string,
      service: Types.ServiceIdWithContact,
      includeContacts: boolean,
      limit?: number
    ) => {
      requestIdleCallback(() => {
        dispatch(
          TeamBuildingGen.createSearch({
            includeContacts,
            limit,
            namespace,
            query,
            service,
          })
        )
      })
    },
    time
  )

const debouncedSearch = makeDebouncedSearch(500) // 500ms debounce on social searches
const debouncedSearchKeybase = makeDebouncedSearch(200) // 200 ms debounce on keybase searches

const StateWrapperForTeamBuilding = () => {
  const route = useRoute()

  // @ts-ignore
  const namespace: Types.AllowedNamespace = route.params?.namespace ?? 'chat2'
  // @ts-ignore
  const teamID: TeamTypes.TeamID = route.params?.teamID
  // @ts-ignore
  const filterServices: undefined | Array<Types.ServiceIdWithContact> = route.params?.filterServices
  // @ts-ignore
  const title: string = route.params?.title ?? ''
  // @ts-ignore
  const goButtonLabel: GoButtonLabel = route.params?.goButtonLabel ?? 'Start'

  const [focusInputCounter, setFocusInputCounter] = React.useState(0)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [searchString, setSearchString] = React.useState('')
  const [selectedService, setSelectedService] = React.useState<Types.ServiceIdWithContact>('keybase')

  const incHighlightIndex = React.useCallback(
    (maxIndex: number) => {
      setHighlightedIndex(old => Math.min(old + 1, maxIndex))
    },
    [setHighlightedIndex]
  )

  const decHighlightIndex = React.useCallback(() => {
    setHighlightedIndex(old => (old < 1 ? 0 : old - 1))
  }, [setHighlightedIndex])

  const resetHighlightIndex = React.useCallback(
    (resetToHidden?: boolean) => {
      setHighlightedIndex(resetToHidden ? -1 : 0)
    },
    [setHighlightedIndex]
  )

  const incFocusInputCounter = React.useCallback(() => {
    setFocusInputCounter(old => old + 1)
  }, [setFocusInputCounter])

  const teamBuildingState = Container.useSelector(state => state[namespace].teamBuilding)
  const teamBuildingSearchResults = teamBuildingState.searchResults
  const userResults: Array<Types.User> | undefined = teamBuildingState.searchResults
    .get(trim(searchString))
    ?.get(selectedService)

  const maybeTeamMeta = Container.useSelector(state => (teamID ? getTeamMeta(state, teamID) : undefined))
  const maybeTeamDetails = Container.useSelector(state =>
    teamID ? getTeamDetails(state, teamID) : undefined
  )
  const preExistingTeamMembers: TeamTypes.TeamDetails['members'] = maybeTeamDetails?.members ?? emptyMap
  const contactsImported = Container.useSelector(state => state.settings.contacts.importEnabled)
  const contactsPermissionStatus = Container.useSelector(state => state.settings.contacts.permissionStatus)
  const username = Container.useSelector(state => state.config.username)
  const following = Container.useSelector(state => state.config.following)
  const waitingForCreate = Container.useSelector(state =>
    WaitingConstants.anyWaiting(state, ChatConstants.waitingKeyCreating)
  )

  const showingContactsButton =
    Container.isMobile && contactsPermissionStatus !== 'never_ask_again' && !contactsImported

  const error = teamBuildingState.error
  const recommendations = deriveRecommendation(
    teamBuildingState.userRecs,
    teamBuildingState.teamSoFar,
    username,
    following,
    preExistingTeamMembers
  )
  const searchResults = deriveSearchResults(
    userResults,
    teamBuildingState.teamSoFar,
    username,
    following,
    preExistingTeamMembers
  )
  const serviceResultCount = deriveServiceResultCount(teamBuildingState.searchResults, searchString)
  const showServiceResultCount = !isMobile && !!searchString
  const teamSoFar = deriveTeamSoFar(teamBuildingState.teamSoFar)
  const teamname = maybeTeamMeta?.teamname
  const userFromUserId = deriveUserFromUserIdFn(userResults, teamBuildingState.userRecs)

  const dispatch = Container.useDispatch()

  const _onAdd = (user: Types.User) => {
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]}))
  }
  const _onCancelTeamBuilding = () => {
    dispatch(TeamBuildingGen.createCancelTeamBuilding({namespace}))
  }

  const _search = (query: string, service: Types.ServiceIdWithContact, limit?: number) => {
    if (service === 'keybase') {
      debouncedSearchKeybase(dispatch, namespace, query, service, namespace === 'chat2', limit)
    } else {
      debouncedSearch(dispatch, namespace, query, service, namespace === 'chat2', limit)
    }
  }

  const onFinishTeamBuilding = () => {
    dispatch(
      namespace === 'teams'
        ? TeamBuildingGen.createFinishTeamBuilding({namespace, teamID})
        : TeamBuildingGen.createFinishedTeamBuilding({namespace})
    )
  }
  const onRemove = (userId: string) => {
    dispatch(TeamBuildingGen.createRemoveUsersFromTeamSoFar({namespace, users: [userId]}))
  }

  const showRecs = !searchString && !!recommendations && selectedService === 'keybase'
  const recommendationsSections = showRecs
    ? sortAndSplitRecommendations(recommendations, showingContactsButton)
    : null
  const userResultsToShow = showRecs ? flattenRecommendations(recommendationsSections || []) : searchResults
  const onChangeText = deriveOnChangeText(setSearchString, _search, selectedService, resetHighlightIndex)
  const onClear = () => onChangeText('')
  const onSearchForMore = () => {
    if (searchResults && searchResults.length >= 10) {
      _search(searchString, selectedService, searchResults.length + 20)
    }
  }
  const onAdd = (userId: string) => {
    const user = userFromUserId(userId)
    if (!user) {
      logger.error(`Couldn't find Types.User to add for ${userId}`)
      onChangeText('')
      return
    }
    onChangeText('')
    _onAdd(user)
    resetHighlightIndex(true)
    incFocusInputCounter()
  }

  const _title = namespace === 'teams' ? `Add to ${teamname}` : title

  const onEnterKeyDown = () => {
    const selectedResult = !!userResultsToShow && userResultsToShow[highlightedIndex]
    if (selectedResult) {
      // We don't handle cases where they hit enter on someone that is already a
      // team member
      if (selectedResult.isPreExistingTeamMember) {
        return
      }
      if (teamSoFar.filter(u => u.userId === selectedResult.userId).length) {
        onRemove(selectedResult.userId)
        onChangeText('')
      } else {
        onAdd(selectedResult.userId)
      }
    } else if (!searchString && !!teamSoFar.length) {
      // They hit enter with an empty search string and a teamSoFar
      // We'll Finish the team building
      onFinishTeamBuilding()
    }
  }

  const onDownArrowKeyDown = () => incHighlightIndex((userResultsToShow?.length ?? 1) - 1)

  const onChangeService = (service: Types.ServiceIdWithContact) => {
    setSelectedService(service)
    incFocusInputCounter()
    if (!Types.isContactServiceId(service)) {
      _search(searchString, service)
    }
  }

  const TEMPPROPS = {
    error,
    filterServices,
    focusInputCounter,
    goButtonLabel,
    highlightedIndex,
    namespace,
    onAdd,
    onChangeService,
    onChangeText,
    onClear,
    onClose: _onCancelTeamBuilding,
    onDownArrowKeyDown,
    onEnterKeyDown,
    onFinishTeamBuilding,
    onRemove,
    onSearchForMore,
    onUpArrowKeyDown: decHighlightIndex,
    recommendations: recommendationsSections,
    search: _search,
    searchResults,
    searchString,
    selectedService,
    serviceResultCount,
    showServiceResultCount: showServiceResultCount && showServiceResultCount,
    teamBuildingSearchResults,
    teamID,
    teamSoFar,
    title: _title,
    waitingForCreate,
  }

  return <TeamBuilding {...TEMPPROPS} />
}

StateWrapperForTeamBuilding.navigationOptions = TeamBuilding.navigationOptions

export default StateWrapperForTeamBuilding
