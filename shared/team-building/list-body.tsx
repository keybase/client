import PeopleResult from './search-result/people-result'
import UserResult from './search-result/user-result'
import type * as Types from './types'
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {RecsAndRecos} from './recs-and-recos'
import throttle from 'lodash/throttle'
import * as Shared from './shared'

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

export const ListBody = (
  props: Pick<
    Types.Props,
    | 'namespace'
    | 'searchString'
    | 'recommendations'
    | 'selectedService'
    | 'showRecs'
    | 'showResults'
    | 'searchResults'
    | 'highlightedIndex'
    | 'recommendedHideYourself'
    | 'onAdd'
    | 'onRemove'
    | 'teamSoFar'
    | 'onSearchForMore'
  > &
    Types.SectionListProp &
    Types.OnScrollProps
) => {
  const {searchString, recommendations, selectedService, showRecs, showResults, searchResults} = props
  const {recommendedHideYourself, onAdd, onRemove, teamSoFar, onSearchForMore} = props
  const {namespace, highlightedIndex, sectionListRef, onScroll} = props
  const ResultRow = namespace === 'people' ? PeopleResult : UserResult
  const showRecPending = !searchString && !recommendations && selectedService === 'keybase'
  const showLoading = !!searchString && !searchResults

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
        sectionListRef={sectionListRef}
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
