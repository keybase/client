// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Banner from './banner'
import BetaNote from './beta-note'
import TeamList from './team-list'

import type {Props as HeaderProps} from './header'
import type {Props as BannerProps} from './banner'
import type {Props as BetaNoteProps} from './beta-note'
import type {Props as TeamListProps} from './team-list'

// TODO: Don't make all these props just so we can pass it down. Make these their own connected components
type Props = HeaderProps & BetaNoteProps & TeamListProps & BannerProps & {sawChatBanner: boolean}

const Teams = (props: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.HeaderHocHeader title="Teams" />
    <Kb.Box style={styles.scrollViewContainer}>
      <Kb.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        <Kb.ButtonBar
          align="space-between"
          bottomBorder={true}
          fullWidth={true}
          small={true}
          style={{
            minHeight: 0,
            paddingBottom: Styles.globalMargins.xtiny,
            paddingTop: Styles.globalMargins.xtiny,
          }}
        >
          <Kb.Button style={styles.button} small={true} type="PrimaryColoredBackground" backgroundMode="Blue" label="Create a team" onClick={props.onCreateTeam} />
          <Kb.Button style={styles.button} small={true} type="PrimaryColoredBackground" backgroundMode="Blue" label="Join a team" onClick={props.onJoinTeam} />
        </Kb.ButtonBar>
        {!props.sawChatBanner && (
          <Banner onReadMore={props.onReadMore} onHideChatBanner={props.onHideChatBanner} />
        )}
        <TeamList
          teamnames={props.teamnames}
          teammembercounts={props.teammembercounts}
          teamresetusers={props.teamresetusers}
          teamNameToIsOpen={props.teamNameToIsOpen}
          newTeams={props.newTeams}
          newTeamRequests={props.newTeamRequests}
          onOpenFolder={props.onOpenFolder}
          onManageChat={props.onManageChat}
          onViewTeam={props.onViewTeam}
        />
        <BetaNote onReadMore={props.onReadMore} />
        {/* Put progress indicator in the footer on mobile because it won't fit in the header on small screens */}
        {Styles.isMobile && (
          <Kb.ProgressIndicator
            style={Styles.collapseStyles([styles.progress, props.loaded && styles.hidden])}
          />
        )}
      </Kb.ScrollView>
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  button: Styles.platformStyles({
    isElectron: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
  }),
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: '100%',
  },
  hidden: {
    opacity: 0,
  },
  progress: {
    alignSelf: 'center',
    marginBottom: Styles.globalMargins.small,
    width: 20,
  },
  scrollView: {...Styles.globalStyles.fillAbsolute},
  scrollViewContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },
  scrollViewContent: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
  },
})

export default Teams
