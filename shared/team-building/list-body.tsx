import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Shared from './shared'
import * as Styles from '../styles'
import PeopleResult from './search-result/people-result'
import UserResult from './search-result/user-result'
import throttle from 'lodash/throttle'
import type * as Types from './types'
import {RecsAndRecos} from './recs-and-recos'
import {useRoute} from '@react-navigation/native'

const Suggestions = (props: Pick<Types.Props, 'namespace' | 'selectedService'>) => {
  const {namespace, selectedService} = props
  return (
    <Kb.Box2
      alignSelf="center"
      centerChildren={!Styles.isMobile}
      direction="vertical"
      fullWidth={true}
      gap="tiny"
      style={styles.emptyContainer}
    >
      {!Styles.isMobile && (
        <Kb.Icon
          fontSize={48}
          type={Shared.serviceIdToIconFont(selectedService)}
          style={Styles.collapseStyles([
            !!selectedService && {color: Shared.serviceIdToAccentColor(selectedService)},
          ])}
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

// Flatten list of recommendation sections. After recommendations are organized
// in sections, we also need a flat list of all recommendations to be able to
// know how many we have in total (including "fake" "import contacts" row), and
// which one is currently highlighted, to support keyboard events.
//
// Resulting list may have nulls in place of fake rows.
const flattenRecommendations = (recommendations: Array<Types.SearchRecSection>) => {
  const result: Array<Types.SearchResult | null> = []
  for (const section of recommendations) {
    result.push(...section.data.map(rec => ('isImportButton' in rec || 'isSearchHint' in rec ? null : rec)))
  }
  return result
}

export const ListBody = (
  props: Pick<
    Types.Props,
    | 'namespace'
    | 'searchString'
    | 'recommendations'
    | 'selectedService'
    | 'searchResults'
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
  const {searchString, recommendations, selectedService, searchResults} = props
  const {onAdd, onRemove, teamSoFar, onSearchForMore, onChangeText} = props
  const {namespace, highlightedIndex, offset, enterInputCounter, onFinishTeamBuilding} = props
  const route = useRoute()
  // @ts-ignore
  const recommendedHideYourself = route?.params?.recommendedHideYourself ?? false

  const onScroll: Types.OnScrollProps['onScroll'] = Styles.isMobile
    ? Kb.ReAnimated.event([{nativeEvent: {contentOffset: {y: offset.current}}}], {useNativeDriver: true})
    : undefined

  const oldEnterInputCounter = Container.usePrevious(enterInputCounter)

  const showResults = !!searchString
  const showRecs = !searchString && !!recommendations && selectedService === 'keybase'

  const ResultRow = namespace === 'people' ? PeopleResult : UserResult
  const showRecPending = !searchString && !recommendations && selectedService === 'keybase'
  const showLoading = !!searchString && !searchResults

  Container.useDepChangeEffect(() => {
    if (oldEnterInputCounter !== enterInputCounter) {
      const userResultsToShow = showRecs ? flattenRecommendations(recommendations || []) : searchResults
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
  }, [oldEnterInputCounter, enterInputCounter])

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
  if (!showRecs && !showResults && !!selectedService) {
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

  const _onEndReached = throttle(() => {
    onSearchForMore()
  }, 500)

  return (
    <>
      {searchResults === undefined || searchResults?.length ? (
        <Kb.List
          reAnimated={true}
          items={searchResults || []}
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
              highlight={!Styles.isMobile && index === highlightedIndex}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      emptyContainer: Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          maxWidth: 290,
          paddingBottom: 40,
        },
        isMobile: {maxWidth: '80%'},
      }),
      emptyServiceText: Styles.platformStyles({
        isMobile: {
          paddingBottom: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.small,
        },
      }),
      list: Styles.platformStyles({
        common: {paddingBottom: Styles.globalMargins.small},
      }),
      listContentContainer: Styles.platformStyles({
        isMobile: {paddingTop: Styles.globalMargins.xtiny},
      }),
      loadingAnimation: Styles.platformStyles({
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
        ...Styles.padding(Styles.globalMargins.small),
      },
    } as const)
)
