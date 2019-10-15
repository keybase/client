import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import openUrl from '../../../../util/open-url'

type Props = {
  message: any
  onTeamClick: () => void
  teamname: string
}

const TeamJourneyHeader = (props: Props) => (
  <>
    <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
      <Kb.Avatar
        size={32}
        isTeam={true}
        teamname={props.teamname}
        skipBackground={true}
        onClick={props.onTeamClick}
        style={styles.avatar}
      />
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
        <Kb.Text type="BodySmallBold">{props.teamname}</Kb.Text>
        <Kb.Text type="BodyTiny" style={styles.subtitle}>
          • System message
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
    <Kb.Box2 key="content" direction="vertical" fullWidth={true} style={styles.content}>
      <Kb.Text type="Body">Foo bar.</Kb.Text>
    </Kb.Box2>
  </>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          height: Styles.globalMargins.mediumLarge,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Styles.platformStyles({
        isElectron: {
          marginLeft: Styles.globalMargins.small,
        },
        isMobile: {marginLeft: Styles.globalMargins.tiny},
      }),
      content: Styles.platformStyles({
        isElectron: {
          marginTop: -16,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.small + // left margin
            Styles.globalMargins.mediumLarge, // avatar
        },
        isMobile: {
          marginTop: -12,
          paddingBottom: 3,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
      subtitle: Styles.platformStyles({
        common: {paddingLeft: Styles.globalMargins.xtiny},
        isElectron: {lineHeight: 19},
      }),
    } as const)
)

export default TeamJourneyHeader
