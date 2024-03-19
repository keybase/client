import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Shared from './shared'
import PeopleResult from './search-result/people-result'
import UserResult from './search-result/user-result'
import throttle from 'lodash/throttle'
import trim from 'lodash/trim'
import type * as T from '@/constants/types'
import type * as Types from './types'
import type {RootRouteProps} from '@/router-v2/route-params'
import {RecsAndRecos, numSectionLabel} from './recs-and-recos'
import {formatAnyPhoneNumbers} from '@/util/phone-numbers'
import {useRoute} from '@react-navigation/native'
// import {useAnimatedScrollHandler} from '@/common-adapters/reanimated'

const Suggestions = (props: Pick<Types.Props, 'namespace' | 'selectedService'>) => {
  const {namespace, selectedService} = props
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
          style={Kb.Styles.collapseStyles([{color: Shared.serviceIdToAccentColor(selectedService)}])}
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

function isKeybaseUserId(userId: string) {
  // Only keybase user id's do not have
  return !userId.includes('@')
}

function followStateHelperWithId(
  me: string,
  followingState: ReadonlySet<string>,
  userId: string = ''
): T.TB.FollowingState {
  if (isKeybaseUserId(userId)) {
    if (userId === me) {
      return 'You'
    } else {
      return followingState.has(userId) ? 'Following' : 'NotFollowing'
    }
  }
  return 'NoState'
}

const deriveSearchResults = (
  searchResults: ReadonlyArray<T.TB.User> | undefined,
  teamSoFar: ReadonlySet<T.TB.User>,
  myUsername: string,
  followingState: ReadonlySet<string>,
  preExistingTeamMembers: ReadonlyMap<string, T.Teams.MemberInfo>
) =>
  searchResults?.map(info => {
    const label = info.label || ''
    return {
      contact: !!info.contact,
      displayLabel: formatAnyPhoneNumbers(label),
      followingState: followStateHelperWithId(myUsername, followingState, info.serviceMap.keybase),
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

// Flatten list of recommendation sections. After recommendations are organized
// in sections, we also need a flat list of all recommendations to be able to
// know how many we have in total (including "fake" "import contacts" row), and
// which one is currently highlighted, to support keyboard events.
//
// Resulting list may have nulls in place of fake rows.
const flattenRecommendations = (recommendations: Array<Types.SearchRecSection>) => {
  const result: Array<Types.SearchResult | undefined> = []
  for (const section of recommendations) {
    result.push(
      ...section.data.map(rec => ('isImportButton' in rec || 'isSearchHint' in rec ? undefined : rec))
    )
  }
  return result
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz'
const aCharCode = alphabet.charCodeAt(0)
const alphaSet = new Set(alphabet)
const isAlpha = (letter: string) => alphaSet.has(letter)
const letterToAlphaIndex = (letter: string) => letter.charCodeAt(0) - aCharCode

// Returns array with 28 entries
// 0 - "Recommendations" section
// 1-26 - a-z sections
// 27 - 0-9 section
const sortAndSplitRecommendations = (
  results: T.Unpacked<typeof deriveSearchResults>,
  showingContactsButton: boolean
): Array<Types.SearchRecSection> | undefined => {
  if (!results) return undefined

  const sections: Array<Types.SearchRecSection> = [
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
      sections[recSectionIdx]?.data.push(rec)
      return
    }
    if (rec.prettyName || rec.displayLabel) {
      // Use the first letter of the name we will display, but first normalize out
      // any diacritics.
      const decodedLetter = /*unidecode*/ rec.prettyName || rec.displayLabel
      if (decodedLetter[0]) {
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
          sections[sectionIdx]?.data.push(rec)
        } else {
          if (!sections[numSectionIdx]) {
            sections[numSectionIdx] = {
              data: [],
              label: numSectionLabel,
              shortcut: true,
            }
          }
          sections[numSectionIdx]?.data.push(rec)
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
  return sections.filter(s => s.data.length > 0)
}

const emptyMap = new Map()

export const ListBody = (
  props: Pick<
    Types.Props,
    | 'namespace'
    | 'searchString'
    | 'selectedService'
    | 'highlightedIndex'
    | 'onAdd'
    | 'onRemove'
    | 'teamSoFar'
    | 'onSearchForMore'
    | 'onChangeText'
    | 'onFinishTeamBuilding'
  > & {
    offset: any
    enterInputCounter: number
  }
) => {
  const {params} = useRoute<RootRouteProps<'peopleTeamBuilder'>>()
  const recommendedHideYourself = params.recommendedHideYourself ?? false
  const teamID = params.teamID
  const {searchString, selectedService} = props
  const {onAdd, onRemove, teamSoFar, onSearchForMore, onChangeText} = props
  const {namespace, highlightedIndex, /*offset, */ enterInputCounter, onFinishTeamBuilding} = props

  const contactsImported = C.useSettingsContactsState(s => s.importEnabled)
  const contactsPermissionStatus = C.useSettingsContactsState(s => s.permissionStatus)

  const username = C.useCurrentUserState(s => s.username)
  const following = C.useFollowerState(s => s.following)

  const maybeTeamDetails = C.useTeamsState(s => (teamID ? s.teamDetails.get(teamID) : undefined))
  const preExistingTeamMembers: T.Teams.TeamDetails['members'] = maybeTeamDetails?.members ?? emptyMap
  const userRecs = C.useTBContext(s => s.userRecs)
  const _teamSoFar = C.useTBContext(s => s.teamSoFar)
  const _searchResults = C.useTBContext(s => s.searchResults)
  const _recommendations = React.useMemo(
    () => deriveSearchResults(userRecs, _teamSoFar, username, following, preExistingTeamMembers),
    [userRecs, _teamSoFar, username, following, preExistingTeamMembers]
  )

  const userResults: ReadonlyArray<T.TB.User> | undefined = _searchResults
    .get(trim(searchString))
    ?.get(selectedService)

  const searchResults = React.useMemo(
    () => deriveSearchResults(userResults, _teamSoFar, username, following, preExistingTeamMembers),
    [userResults, _teamSoFar, username, following, preExistingTeamMembers]
  )

  // TODO this crashes out renimated 3 https://github.com/software-mansion/react-native-reanimated/issues/2285
  // in the tab bar, so we just disconnect the shared value for now, likely can just leave this as-is
  // const onScroll: any = useAnimatedScrollHandler({onScroll: e => (offset.value = e.contentOffset.y)})
  const onScroll = undefined

  const showResults = !!searchString
  const showRecs = !searchString && !!_recommendations && selectedService === 'keybase'

  const ResultRow = namespace === 'people' ? PeopleResult : UserResult
  const showLoading = !!searchString && !searchResults

  const showingContactsButton = C.isMobile && contactsPermissionStatus !== 'denied' && !contactsImported
  const recommendations = React.useMemo(() => {
    return showRecs ? sortAndSplitRecommendations(_recommendations, showingContactsButton) : undefined
  }, [showRecs, _recommendations, showingContactsButton])

  const showRecPending = !searchString && !recommendations && selectedService === 'keybase'

  const lastEnterInputCounterRef = React.useRef(enterInputCounter)
  if (lastEnterInputCounterRef.current !== enterInputCounter) {
    lastEnterInputCounterRef.current = enterInputCounter
    const userResultsToShow = showRecs ? flattenRecommendations(recommendations ?? []) : searchResults
    const selectedResult =
      !!userResultsToShow && userResultsToShow[highlightedIndex % userResultsToShow.length]
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

  if (showRecPending || showLoading) {
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        gap="xtiny"
        centerChildren={true}
        style={styles.loadingContainer}
      >
        {showLoading && <Kb.Animation animationType="spinner" style={styles.loadingAnimation} />}
      </Kb.Box2>
    )
  }
  if (!showRecs && !showResults) {
    return <Suggestions namespace={namespace} selectedService={selectedService} />
  }

  if (showRecs && recommendations) {
    return (
      <RecsAndRecos
        highlightedIndex={highlightedIndex}
        recommendations={recommendations}
        onScroll={onScroll}
        recommendedHideYourself={recommendedHideYourself}
        namespace={namespace}
        selectedService={selectedService}
        onAdd={onAdd}
        onRemove={onRemove}
        teamSoFar={teamSoFar}
      />
    )
  }

  const _onSearchForMore = () => {
    onSearchForMore(searchResults?.length ?? 0)
  }

  const _onEndReached = throttle(_onSearchForMore, 500)

  return (
    <>
      {searchResults?.length ? (
        <Kb.List
          reAnimated={true}
          items={searchResults}
          onScroll={onScroll}
          selectedIndex={highlightedIndex || 0}
          style={styles.list}
          contentContainerStyle={styles.listContentContainer}
          keyboardShouldPersistTaps="handled"
          keyProperty="key"
          onEndReached={_onEndReached}
          onEndReachedThreshold={0.1}
          renderItem={(index, result) => (
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
      ) : (
        <Kb.Text type="BodySmall" style={styles.noResults}>
          Sorry, no results were found.
        </Kb.Text>
      )}
    </>
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
      }),
      listContentContainer: Kb.Styles.platformStyles({
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
      loadingContainer: {
        flex: 1,
        justifyContent: 'flex-start',
      },
      noResults: {
        flex: 1,
        textAlign: 'center',
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      },
    }) as const
)
