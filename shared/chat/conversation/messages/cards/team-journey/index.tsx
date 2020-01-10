import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as ChatTypes from '../../../../../constants/types/chat2'

export type Action =
  | {
      label: string
      onClick: () => void
    }
  | 'wave'

type Props = {
  actions: Array<Action>
  conversationIDKey: ChatTypes.ConversationIDKey
  image: Kb.IconType | null
  loadTeam?: () => void
  onAuthorClick: () => void
  onDismiss: () => void
  teamname: string
  textComponent: React.ReactNode
}

export const TeamJourney = (props: Props) => {
  // Load the team once on mount for its channel list if required.
  const {conversationIDKey, loadTeam, teamname} = props
  React.useEffect(() => {
    loadTeam?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <TeamJourneyHeader teamname={teamname} onAuthorClick={props.onAuthorClick} onDismiss={props.onDismiss} />
      <Kb.Box2 key="content" direction="vertical" fullWidth={true} style={styles.content}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.Box2 direction="horizontal" style={props.image ? styles.text : undefined}>
            {props.textComponent}
          </Kb.Box2>
          {!!props.image && <Kb.Icon style={styles.image} type={props.image} />}
        </Kb.Box2>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems={'flex-start'}
          gap="tiny"
          style={styles.actionsBox}
        >
          {props.actions.map(action =>
            action == 'wave' ? (
              <Kb.WaveButton conversationIDKey={conversationIDKey} small={true} style={styles.buttonSpace} />
            ) : (
              <Kb.Button
                key={action.label}
                small={true}
                type="Default"
                mode="Secondary"
                label={action.label}
                onClick={action.onClick}
                style={styles.buttonSpace}
              />
            )
          )}
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

type HeaderProps = {
  teamname: string
  onAuthorClick: () => void
  onDismiss: () => void
}
const TeamJourneyHeader = (props: HeaderProps) => (
  <Kb.Box2 key="author" direction="horizontal" fullWidth={true} style={styles.authorContainer} gap="tiny">
    <Kb.Avatar
      size={32}
      isTeam={true}
      teamname={props.teamname}
      skipBackground={true}
      style={styles.avatar}
      onClick={props.onAuthorClick}
    />
    <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={false} alignSelf="flex-start" style={styles.bottomLine}>
      <Kb.Text
        style={styles.teamnameText}
        type="BodySmallBold"
        onClick={props.onAuthorClick}
        className="hover-underline"
      >
        {props.teamname}
      </Kb.Text>
      <Kb.Text type="BodyTiny">• System message</Kb.Text>
    </Kb.Box2>
    {!Styles.isMobile && <Kb.Icon type="iconfont-close" onClick={props.onDismiss} fontSize={12} />}
  </Kb.Box2>
)

const buttonSpace = 6

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionsBox: Styles.platformStyles({
        common: {
          marginTop: Styles.globalMargins.tiny - buttonSpace,
          minHeight: 50,
        },
        isElectron: {
          flexWrap: 'wrap',
        },
      }),
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
          marginTop: Styles.globalMargins.xtiny,
        },
        isMobile: {marginLeft: Styles.globalMargins.tiny},
      }),
      bottomLine: {
        ...Styles.globalStyles.flexGrow,
        alignItems: 'baseline',
      },
      buttonSpace: {
        marginTop: buttonSpace,
      },
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
      image: {
        left: '50%',
        position: 'absolute',
      },
      teamnameText: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black,
        },
      }),
      text: {
        maxWidth: '45%',
      },
    } as const)
)

export default TeamJourney
