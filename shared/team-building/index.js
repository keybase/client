// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import TeamBox from './team-box'
import GoButton from './go-button'
import ServiceTabBar from './service-tab-bar'
import UserResult from './user-result'
import type {ServiceIdWithContact, FollowingState} from '../constants/types/team-building'

// TODO
// Services Search Results count bar
// Handle pending state
// Handle No search results

type SearchResult = {
  userId: string,
  username: string,
  prettyName: string,
  services: {[key: ServiceIdWithContact]: string},
  inTeam: boolean,
  followingState: FollowingState,
}

export type Props = {
  onFinishTeamBuilding: () => void,
  onChangeText: (newText: string) => void,
  onEnterKeyDown: () => void,
  onDownArrowKeyDown: () => void,
  onUpArrowKeyDown: () => void,
  teamSoFar: Array<{userId: string, prettyName: string, service: ServiceIdWithContact, username: string}>,
  onRemove: (userId: string) => void,
  onBackspace: () => void,
  selectedService: ServiceIdWithContact,
  onChangeService: (newService: ServiceIdWithContact) => void,
  serviceResultCount: {[key: ServiceIdWithContact]: ?number},
  showServiceResultCount: boolean,
  searchResults: ?Array<SearchResult>,
  highlightedIndex: ?number,
  onAdd: (userId: string) => void,
  searchString: string,
}

const TeamBuilding = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <TeamBox
        onChangeText={props.onChangeText}
        onDownArrowKeyDown={props.onDownArrowKeyDown}
        onUpArrowKeyDown={props.onUpArrowKeyDown}
        onEnterKeyDown={props.onEnterKeyDown}
        onRemove={props.onRemove}
        teamSoFar={props.teamSoFar}
        onBackspace={props.onBackspace}
        searchString={props.searchString}
      />
      {!!props.teamSoFar.length && <GoButton onClick={props.onFinishTeamBuilding} />}
    </Kb.Box2>
    <ServiceTabBar
      selectedService={props.selectedService}
      onChangeService={props.onChangeService}
      serviceResultCount={props.serviceResultCount}
      showServiceResultCount={props.showServiceResultCount}
    />
    {!props.searchResults ? (
      <Kb.Text type="Body"> TODO: Add Pending state</Kb.Text>
    ) : (
      <Kb.List
        items={props.searchResults}
        selectedIndex={props.highlightedIndex || 0}
        renderItem={(index, result) => (
          <UserResult
            key={result.userId}
            fixedHeight={400}
            username={result.username}
            prettyName={result.prettyName}
            services={result.services}
            inTeam={result.inTeam}
            followingState={result.followingState}
            highlight={index === props.highlightedIndex}
            onAdd={() => props.onAdd(result.userId)}
            onRemove={() => props.onRemove(result.userId)}
          />
        )}
      />
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      flex: 1,
      minHeight: 200,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      width: 470,
      height: 434,
    },
  }),
})

export default TeamBuilding
