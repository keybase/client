// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Header from './header'
import Banner from './banner'
import BetaNote from './beta-note'
import TeamList from './team-list'

import type {Props as HeaderProps} from './header'
import type {Props as BannerProps} from './banner'
import type {Props as BetaNoteProps} from './beta-note'
import type {Props as TeamListProps} from './team-list'

// TODO: Don't make all these props just so we can pass it down. Make these their own connected components
type Props = {|
  ...$Exact<HeaderProps>,
  ...$Exact<BetaNoteProps>,
  ...$Exact<TeamListProps>,
  ...$Exact<BannerProps>,
  ...{|sawChatBanner: boolean, title: string, onBack: () => void|},
|}

const Teams = (props: Props) => (
  <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center', height: '100%'}}>
    <Header loaded={props.loaded} onCreateTeam={props.onCreateTeam} onJoinTeam={props.onJoinTeam} />
    <Kb.Box style={{flex: 1, position: 'relative', width: '100%'}}>
      <Kb.ScrollView
        style={{...Styles.globalStyles.fillAbsolute}}
        contentContainerStyle={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
        }}
      >
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
            style={{
              alignSelf: 'center',
              marginBottom: Styles.globalMargins.small,
              opacity: props.loaded ? 0 : 1,
              width: 20,
            }}
          />
        )}
      </Kb.ScrollView>
    </Kb.Box>
  </Kb.Box>
)

export default Teams
