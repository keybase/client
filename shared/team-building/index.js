// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import TeamBox from './team-box'
import GoButton from './go-button'
import ServiceTabBar from './service-tab-bar'
import UserResult from './user-result'
import flags from '../util/feature-flags'
import {serviceIdToAccentColor, serviceIdToIconFont, serviceIdToLabel} from './shared'
import type {ServiceIdWithContact, FollowingState} from '../constants/types/team-building'

type SearchResult = {
  userId: string,
  username: string,
  prettyName: string,
  services: {[key: ServiceIdWithContact]: string},
  inTeam: boolean,
  followingState: FollowingState,
}

export type Props = {
  fetchUserRecs: () => void,
  highlightedIndex: ?number,
  onAdd: (userId: string) => void,
  onBackspace: () => void,
  onChangeService: (newService: ServiceIdWithContact) => void,
  onChangeText: (newText: string) => void,
  onDownArrowKeyDown: () => void,
  onEnterKeyDown: () => void,
  onFinishTeamBuilding: () => void,
  onMakeItATeam: () => void,
  onRemove: (userId: string) => void,
  onSearchForMore: () => void,
  onUpArrowKeyDown: () => void,
  recommendations: ?Array<SearchResult>,
  searchResults: ?Array<SearchResult>,
  searchString: string,
  selectedService: ServiceIdWithContact,
  serviceResultCount: {[key: ServiceIdWithContact]: ?number},
  showRecs: boolean,
  showServiceResultCount: boolean,
  teamSoFar: Array<{userId: string, prettyName: string, service: ServiceIdWithContact, username: string}>,
}

class TeamBuilding extends React.PureComponent<Props, void> {
  componentDidMount = () => {
    this.props.fetchUserRecs()
  }

  render = () => {
    const props = this.props
    const showRecPending = !props.searchString && !(props.recommendations && props.recommendations.length)
    const showLoading = !!props.searchString && !(props.searchResults && props.searchResults.length)
    const showRecs = props.showRecs
    return (
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
          {!!props.teamSoFar.length && !Styles.isMobile && <GoButton onClick={props.onFinishTeamBuilding} />}
        </Kb.Box2>
        {!!props.teamSoFar.length && flags.newTeamBuildingForChatAllowMakeTeam && (
          <Kb.Text type="BodySmall">
            Add up to 14 more people. Need more?
            <Kb.Text type="BodySmallPrimaryLink" onClick={props.onMakeItATeam}>
              {' '}
              Make it a team.
            </Kb.Text>
          </Kb.Text>
        )}
        <ServiceTabBar
          selectedService={props.selectedService}
          onChangeService={props.onChangeService}
          serviceResultCount={props.serviceResultCount}
          showServiceResultCount={props.showServiceResultCount}
        />
        {showRecPending || showLoading ? (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.loadingContainer}>
            <Kb.Icon
              style={Kb.iconCastPlatformStyles(styles.loadingIcon)}
              type="icon-progress-grey-animated"
            />
            <Kb.Text type="BodySmallSemibold">Loading</Kb.Text>
          </Kb.Box2>
        ) : !showRecs && !props.showServiceResultCount && !!props.selectedService ? (
          <Kb.Box2
            alignSelf="center"
            centerChildren={true}
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            gap="tiny"
            style={styles.emptyContainer}
          >
            <Kb.Icon
              fontSize={64}
              type={serviceIdToIconFont(props.selectedService)}
              style={Styles.collapseStyles([
                !!props.selectedService && {color: serviceIdToAccentColor(props.selectedService)},
              ])}
            />
            <Kb.Text center={true} type="BodyBig">
              Enter a {serviceIdToLabel(props.selectedService)} username above.
            </Kb.Text>
            <Kb.Text center={true} type="BodySmall">
              Start a Keybase chat with anyone on {serviceIdToLabel(props.selectedService)}, even if they
              don’t have a Keybase account.
            </Kb.Text>
          </Kb.Box2>
        ) : (
          <Kb.List
            items={showRecs ? props.recommendations || [] : props.searchResults || []}
            selectedIndex={props.highlightedIndex || 0}
            style={styles.list}
            keyProperty={'userId'}
            onEndReached={props.onSearchForMore}
            renderItem={(index, result) => (
              <UserResult
                resultForService={props.selectedService}
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
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      flex: 1,
      minHeight: 200,
    },
    isElectron: {
      height: 434,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
      width: 470,
    },
  }),
  emptyContainer: Styles.platformStyles({
    common: {
      flex: 1,
    },
    isElectron: {
      maxWidth: 290,
      paddingBottom: 40,
    },
    isMobile: {
      maxWidth: '80%',
      paddingBottom: 150,
    },
  }),
  list: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
    },
    isMobile: {
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingIcon: Styles.platformStyles({
    isElectron: {
      height: 32,
      width: 32,
    },
    isMobile: {
      height: 48,
      width: 48,
    },
  }),
})

export default TeamBuilding
