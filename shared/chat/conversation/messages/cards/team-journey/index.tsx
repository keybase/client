import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type Action = {
  label: string
  onClick: () => void
}

type Props = {
  actions: Array<Action>
  image: string
  loadTeam: (() => void) | null
  teamname: string
  text: string
}

const TeamJourney = (props: Props) => {
  // Load the team once on mount for its channel list if required.
  React.useEffect(() => {
    props.loadTeam !== null && props.loadTeam()
  }, [])
  return (
    <>
      <TeamJourneyHeader teamname={props.teamname} />
      <Kb.Box2 key="content" direction="vertical" fullWidth={true} style={styles.content}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.Text type="Body">{props.text}</Kb.Text>
          {!!props.image && <Kb.Icon type={props.image} />}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.actionsBox}>
          {props.actions.map(action => (
            <Kb.Button
              key={action.label}
              small={true}
              type="Default"
              mode="Secondary"
              label={action.label}
              onClick={action.onClick}
            />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

type HeaderProps = {
  teamname: string
}
const TeamJourneyHeader = (props: HeaderProps) => (
  <>
    <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
      <Kb.Avatar
        size={32}
        isTeam={true}
        teamname={props.teamname}
        skipBackground={true}
        style={styles.avatar}
      />
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
        <Kb.Text style={styles.teamnameText} type="BodySmallBold">{props.teamname}</Kb.Text>
        <Kb.Text type="BodyTiny">• System message</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionsBox: {
        marginTop: Styles.globalMargins.tiny,
      },
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
      teamnameText: {
        color: Styles.globalColors.black,
      },
    } as const)
)

export default TeamJourney
