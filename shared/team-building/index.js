// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import TeamBox from './team-box'
import GoButton from './go-button'
import ServiceTabBar from './service-tab-bar'
import UserResult from './user-result'
import flags from '../util/feature-flags'
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
        {showRecs && !showRecPending && (
          <Kb.Text type={Styles.isMobile ? 'BodySmallSemibold' : 'BodyTinySemibold'} style={styles.recText}>
            Recommendations
          </Kb.Text>
        )}
        {showRecPending ? (
          <Kb.Text type={Styles.isMobile ? 'BodySmallSemibold' : 'BodyTinySemibold'} style={styles.recText}>
            ...
          </Kb.Text>
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
  list: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
    },
    isMobile: {
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
  recText: Styles.platformStyles({
    common: {
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      borderStyle: 'solid',
      paddingBottom: Styles.globalMargins.xtiny,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
})

export default TeamBuilding
