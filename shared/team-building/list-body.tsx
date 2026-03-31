import * as React from 'react'
import * as C from '@/constants'
import * as TB from '@/stores/team-building'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as Shared from './shared'
import PeopleResult from './search-result/people-result'
import UserResult from './search-result/user-result'
import throttle from 'lodash/throttle'
import type * as T from '@/constants/types'
import type * as Types from './types'
import type {RootRouteProps} from '@/router-v2/route-params'
import {RecsAndRecos, numSectionLabel} from './recs-and-recos'
import {formatAnyPhoneNumbers} from '@/util/phone-numbers'
import {useRoute} from '@react-navigation/native'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {useColorScheme} from 'react-native'

type SuggestionsProps = {
  namespace: T.TB.AllowedNamespace
  selectedService: T.TB.ServiceIdWithContact
}

type ListBodyProps = {
  namespace: T.TB.AllowedNamespace
  searchString: string
  selectedService: T.TB.ServiceIdWithContact
  highlightedIndex: number
  onAdd: (userId: string) => void
  onRemove: (userId: string) => void
  teamSoFar: ReadonlyArray<T.TB.SelectedUser>
  onSearchForMore: (len: number) => void
  onChangeText: (newText: string) => void
  onFinishTeamBuilding: () => void
  offset: unknown
  enterInputCounter: number
}

type DerivedResults = ReturnType<typeof deriveSearchResults>

const Suggestions = ({namespace, selectedService}: SuggestionsProps) => {
  const isDarkMode = useColorScheme() === 'dark'
  return (
    <Kb.Box2
      alignSelf="center"
      centerChildren={!Kb.Styles.isMobile}
      direction="vertical"
      fullWidth={true}
      gap="tiny"
      style={styles.emptyContainer}
    >
      {!Kb.Styles.isMobile && (
        <Kb.Icon
          fontSize={48}
          type={Shared.serviceIdToIconFont(selectedService)}
          color={Shared.serviceIdToAccentColor(selectedService, isDarkMode)}
        />
      )}
      {namespace === 'people' ? (
        <Kb.Text center={true} style={styles.emptyServiceText} type="BodySmall">
          Search for anyone on {Shared.serviceIdToLabel(selectedService)} and start a chat. Your messages will
          unlock after they install Keybase and prove their {Shared.serviceIdToLabel(selectedService)}{' '}
          username.
        </Kb.Text>
      ) : namespace === 'teams' ? (
        <Kb.Text center={true} style={styles.emptyServiceText} type="BodySmall">
          Add anyone from {Shared.serviceIdToLabel(selectedService)}, then tell them to install Keybase. They
          will automatically join the team once they sign up and prove their{' '}
          {Shared.serviceIdToLabel(selectedService)} username.
        </Kb.Text>
      ) : (
        <Kb.Text center={true} style={styles.emptyServiceText} type="BodySmall">
          Start a chat with anyone on {Shared.serviceIdToLabel(selectedService)}, then tell them to install
          Keybase. Your messages will unlock after they sign up and prove their{' '}
          {Shared.serviceIdToLabel(selectedService)} username.
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const isKeybaseUserId = (userId: string) => !userId.includes('@')

const getFollowingState = (
  myUsername: string,
  following: ReadonlySet<string>,
  userId = ''
): T.TB.FollowingState => {
  if (!isKeybaseUserId(userId)) {
    return 'NoState'
  }

  if (userId === myUsername) {
    return 'You'
  }

  return following.has(userId) ? 'Following' : 'NotFollowing'
}

const deriveSearchResults = (
  users: ReadonlyArray<T.TB.User> | undefined,
  teamSoFar: ReadonlySet<T.TB.User>,
  myUsername: string,
  following: ReadonlySet<string>,
  preExistingTeamMembers: ReadonlyMap<string, T.Teams.MemberInfo>
) => {
  const teamMemberIds = new Set([...teamSoFar].map(user => user.id))

  return users?.map(info => {
    const label = info.label || ''
    return {
      contact: !!info.contact,
      displayLabel: formatAnyPhoneNumbers(label),
      followingState: getFollowingState(myUsername, following, info.serviceMap.keybase),
      inTeam: teamMemberIds.has(info.id),
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
}

const toSelectableRecommendation = (rec: Types.ResultData) =>
  'isImportButton' in rec || 'isSearchHint' in rec ? undefined : rec

const flattenRecommendations = (recommendations: ReadonlyArray<Types.SearchRecSection>) =>
  recommendations.reduce<Array<Types.SearchResult | undefined>>((results, section) => {
    results.push(...section.data.map(toSelectableRecommendation))
    return results
  }, [])

const alphabet = 'abcdefghijklmnopqrstuvwxyz'
const aCharCode = alphabet.charCodeAt(0)
const alphaSet = new Set(alphabet)
const isAlpha = (letter: string) => alphaSet.has(letter)
const letterToAlphaIndex = (letter: string) => letter.charCodeAt(0) - aCharCode

const createSection = (
  label: string,
  shortcut: boolean,
  data: Array<Types.ResultData> = []
): Types.SearchRecSection => ({
  data,
  label,
  shortcut,
})

const getRecommendationsSectionIndex = (
  rec: Types.SearchResult,
  recommendationIndex: number,
  numericSectionIndex: number
) => {
  if (!rec.contact) {
    return recommendationIndex
  }

  const displayName = rec.prettyName || rec.displayLabel
  const firstLetter = displayName[0]?.toLowerCase()
  if (!firstLetter) {
    return undefined
  }

  return isAlpha(firstLetter)
    ? letterToAlphaIndex(firstLetter) + recommendationIndex + 1
    : numericSectionIndex
}

// Returns array with 28 entries
// 0 - "Recommendations" section
// 1-26 - a-z sections
// 27 - 0-9 section
const sortAndSplitRecommendations = (
  results: DerivedResults,
  showingContactsButton: boolean
): Array<Types.SearchRecSection> | undefined => {
  if (!results) {
    return undefined
  }

  const sections: Array<Types.SearchRecSection> = []
  if (showingContactsButton) {
    sections.push(createSection('', false, [{isImportButton: true}]))
  }
  sections.push(createSection('Recommendations', false))

  const recommendationIndex = sections.length - 1
  const numericSectionIndex = recommendationIndex + 27

  results.forEach(rec => {
    const sectionIndex = getRecommendationsSectionIndex(rec, recommendationIndex, numericSectionIndex)
    if (sectionIndex === undefined) {
      return
    }

    if (!sections[sectionIndex]) {
      const isNumericSection = sectionIndex === numericSectionIndex
      const label = isNumericSection
        ? numSectionLabel
        : String.fromCharCode(aCharCode + sectionIndex - recommendationIndex - 1).toUpperCase()
      sections[sectionIndex] = createSection(label, true)
    }
    sections[sectionIndex].data.push(rec)
  })

  if (results.length < 5) {
    sections.push(createSection('', false, [{isSearchHint: true}]))
  }

  return sections.filter(section => section.data.length > 0)
}

const getSearchResults = (
  searchResults: T.TB.SearchResults,
  searchString: string,
  selectedService: T.TB.ServiceIdWithContact
) => searchResults.get(searchString.trim())?.get(selectedService)

const getSelectableResults = (
  showRecs: boolean,
  recommendations: ReadonlyArray<Types.SearchRecSection> | undefined,
  searchResults: DerivedResults
) => (showRecs ? flattenRecommendations(recommendations ?? []) : searchResults)

const getHighlightedResult = (
  highlightedIndex: number,
  userResults: ReturnType<typeof getSelectableResults>
) => {
  if (!userResults?.length) {
    return undefined
  }

  return userResults[highlightedIndex % userResults.length]
}

const emptyMap = new Map<string, T.Teams.MemberInfo>()

const useListBodyData = ({
  searchString,
  selectedService,
  teamID,
}: {
  searchString: string
  selectedService: T.TB.ServiceIdWithContact
  teamID?: T.Teams.TeamID
}) => {
  const {contactsImported, contactsPermissionStatus} = useSettingsContactsState(
    C.useShallow(s => ({
      contactsImported: s.importEnabled,
      contactsPermissionStatus: s.permissionStatus,
    }))
  )
  const username = useCurrentUserState(s => s.username)
  const following = useFollowerState(s => s.following)
  const maybeTeamDetails = useTeamsState(s => (teamID ? s.teamDetails.get(teamID) : undefined))
  const preExistingTeamMembers: T.Teams.TeamDetails['members'] = maybeTeamDetails?.members ?? emptyMap
  const {allSearchResults, teamSoFar, userRecs} = TB.useTBContext(
    C.useShallow(s => ({
      allSearchResults: s.searchResults,
      teamSoFar: s.teamSoFar,
      userRecs: s.userRecs,
    }))
  )

  const recommendationResults = deriveSearchResults(
    userRecs,
    teamSoFar,
    username,
    following,
    preExistingTeamMembers
  )
  const userResults = getSearchResults(allSearchResults, searchString, selectedService)
  const searchResults = deriveSearchResults(
    userResults,
    teamSoFar,
    username,
    following,
    preExistingTeamMembers
  )

  const showResults = !!searchString
  const showRecs = !searchString && !!recommendationResults && selectedService === 'keybase'
  const showingContactsButton = C.isMobile && contactsPermissionStatus !== 'denied' && !contactsImported
  const recommendations = showRecs
    ? sortAndSplitRecommendations(recommendationResults, showingContactsButton)
    : undefined

  return {
    recommendations,
    searchResults,
    showLoading: !!searchString && !searchResults,
    showRecPending: !searchString && !recommendations && selectedService === 'keybase',
    showRecs,
    showResults,
  }
}

const useEnterKeyHandler = ({
  enterInputCounter,
  highlightedIndex,
  onAdd,
  onChangeText,
  onFinishTeamBuilding,
  onRemove,
  recommendations,
  searchResults,
  searchString,
  showRecs,
  teamSoFar,
}: {
  enterInputCounter: number
  highlightedIndex: number
  onAdd: (userId: string) => void
  onChangeText: (newText: string) => void
  onFinishTeamBuilding: () => void
  onRemove: (userId: string) => void
  recommendations: ReadonlyArray<Types.SearchRecSection> | undefined
  searchResults: DerivedResults
  searchString: string
  showRecs: boolean
  teamSoFar: ReadonlyArray<T.TB.SelectedUser>
}) => {
  const lastEnterInputCounterRef = React.useRef(enterInputCounter)

  React.useEffect(() => {
    if (lastEnterInputCounterRef.current === enterInputCounter) {
      return
    }

    lastEnterInputCounterRef.current = enterInputCounter
    const selectableResults = getSelectableResults(showRecs, recommendations, searchResults)
    const selectedResult = getHighlightedResult(highlightedIndex, selectableResults)

    if (selectedResult) {
      if (selectedResult.isPreExistingTeamMember) {
        return
      }

      if (teamSoFar.some(user => user.userId === selectedResult.userId)) {
        onRemove(selectedResult.userId)
        onChangeText('')
      } else {
        onAdd(selectedResult.userId)
      }
      return
    }

    if (!searchString && teamSoFar.length) {
      onFinishTeamBuilding()
    }
  }, [
    enterInputCounter,
    highlightedIndex,
    onAdd,
    onChangeText,
    onFinishTeamBuilding,
    onRemove,
    recommendations,
    searchResults,
    searchString,
    showRecs,
    teamSoFar,
  ])
}

const LoadingState = ({showLoading}: {showLoading: boolean}) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    fullHeight={true}
    gap="xtiny"
    centerChildren={true}
    flex={1}
    justifyContent="flex-start"
  >
    {showLoading && <Kb.Animation animationType="spinner" style={styles.loadingAnimation} />}
  </Kb.Box2>
)

const NoResults = () => (
  <Kb.Text type="BodySmall" style={styles.noResults}>
    Sorry, no results were found.
  </Kb.Text>
)

export const ListBody = ({
  namespace,
  searchString,
  selectedService,
  highlightedIndex,
  onAdd,
  onRemove,
  teamSoFar,
  onSearchForMore,
  onChangeText,
  onFinishTeamBuilding,
  enterInputCounter,
}: ListBodyProps) => {
  const {params} = useRoute<RootRouteProps<'peopleTeamBuilder'>>()
  const recommendedHideYourself = params.recommendedHideYourself ?? false
  const teamID = params.teamID
  const ResultRow = namespace === 'people' ? PeopleResult : UserResult

  const {recommendations, searchResults, showLoading, showRecPending, showRecs, showResults} =
    useListBodyData({
      searchString,
      selectedService,
      teamID,
    })

  useEnterKeyHandler({
    enterInputCounter,
    highlightedIndex,
    onAdd,
    onChangeText,
    onFinishTeamBuilding,
    onRemove,
    recommendations,
    searchResults,
    searchString,
    showRecs,
    teamSoFar,
  })

  if (showRecPending || showLoading) {
    return <LoadingState showLoading={showLoading} />
  }

  if (!showRecs && !showResults) {
    return <Suggestions namespace={namespace} selectedService={selectedService} />
  }

  if (showRecs && recommendations) {
    return (
      <RecsAndRecos
        highlightedIndex={highlightedIndex}
        recommendations={recommendations}
        recommendedHideYourself={recommendedHideYourself}
        namespace={namespace}
        selectedService={selectedService}
        onAdd={onAdd}
        onRemove={onRemove}
        teamSoFar={teamSoFar}
      />
    )
  }

  const onEndReached = throttle(() => {
    onSearchForMore(searchResults?.length ?? 0)
  }, 500)

  return searchResults?.length ? (
    <Kb.BoxGrow>
      <Kb.List
        reAnimated={true}
        items={searchResults}
        selectedIndex={highlightedIndex || 0}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyProperty="key"
        onEndReached={onEndReached}
        itemHeight={{height: Kb.Styles.isMobile ? 64 : 48, type: 'fixed'}}
        renderItem={(index: number, result: (typeof searchResults)[number]) => (
          <ResultRow
            key={result.username}
            resultForService={selectedService}
            username={result.username}
            prettyName={result.prettyName}
            pictureUrl={result.pictureUrl}
            displayLabel={result.displayLabel}
            services={result.services}
            namespace={namespace}
            inTeam={result.inTeam}
            isPreExistingTeamMember={result.isPreExistingTeamMember}
            isYou={result.isYou}
            followingState={result.followingState}
            highlight={!Kb.Styles.isMobile && index === highlightedIndex}
            userId={result.userId}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        )}
      />
    </Kb.BoxGrow>
  ) : (
    <NoResults />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      emptyContainer: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          maxWidth: 290,
          paddingBottom: 40,
        },
        isMobile: {maxWidth: '80%'},
      }),
      emptyServiceText: Kb.Styles.platformStyles({
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
        },
      }),
      list: Kb.Styles.platformStyles({
        common: {paddingBottom: Kb.Styles.globalMargins.small},
        isMobile: {paddingTop: Kb.Styles.globalMargins.xtiny},
      }),
      loadingAnimation: Kb.Styles.platformStyles({
        isElectron: {
          height: 32,
          width: 32,
        },
        isMobile: {
          height: 48,
          width: 48,
        },
      }),
      noResults: {
        flex: 1,
        textAlign: 'center',
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      },
    }) as const
)
