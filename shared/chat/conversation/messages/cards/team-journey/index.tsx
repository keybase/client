import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as ChatTypes from '../../../../../constants/types/chat2'
import * as TeamTypes from '../../../../../constants/types/teams'

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
  loadTeamID?: TeamTypes.TeamID
  onAuthorClick: () => void
  onDismiss: () => void
  teamname: string
  textComponent: React.ReactNode
  deactivateButtons?: boolean
  styles: any
}

export const TeamJourney = (props: Props) => {
  // Load the team once on mount for its channel list if required.
  const {conversationIDKey, loadTeamID, teamname, styles} = props

  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    loadTeamID && dispatch(TeamsGen.createGetChannels({teamID: loadTeamID}))
  }, [loadTeamID, dispatch])

  return (
    <>
      <TeamJourneyHeader
        teamname={teamname}
        onAuthorClick={props.onAuthorClick}
        onDismiss={props.onDismiss}
        deactivateButtons={props.deactivateButtons}
        styles={styles}
      />
      <Kb.Box2
        key="content"
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.content, props.image ? styles.contentWithImage : null])}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.contentHorizontalPad}>
          <Kb.Box2 direction="horizontal" style={props.image ? styles.text : undefined}>
            {props.textComponent}
          </Kb.Box2>
          {!!props.image && <Kb.Icon style={styles.image} type={props.image} />}
        </Kb.Box2>
        <Kb.ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            alignItems={'flex-start'}
            gap="tiny"
            style={Styles.collapseStyles([styles.actionsBox, styles.contentHorizontalPad])}
          >
            {props.actions.map(action =>
              action == 'wave' ? (
                <Kb.WaveButton
                  conversationIDKey={conversationIDKey}
                  small={true}
                  style={styles.buttonSpace}
                  disabled={!!props.deactivateButtons}
                />
              ) : (
                <Kb.Button
                  key={action.label}
                  small={true}
                  type="Default"
                  mode="Secondary"
                  label={action.label}
                  onClick={action.onClick}
                  disabled={!!props.deactivateButtons}
                  style={styles.buttonSpace}
                />
              )
            )}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    </>
  )
}

type HeaderProps = {
  teamname: string
  onAuthorClick: () => void
  onDismiss: () => void
  deactivateButtons?: boolean
  styles: any
}
const TeamJourneyHeader = (props: HeaderProps) => (
  <Kb.Box2
    key="author"
    direction="horizontal"
    fullWidth={true}
    style={props.styles.authorContainer}
    gap="tiny"
  >
    <Kb.Avatar
      size={32}
      isTeam={true}
      teamname={props.teamname}
      skipBackground={true}
      style={props.styles.avatar}
      onClick={props.onAuthorClick}
    />
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      fullWidth={false}
      alignSelf="flex-start"
      style={props.styles.bottomLine}
    >
      <Kb.Text
        style={props.styles.teamnameText}
        type="BodySmallBold"
        onClick={props.onAuthorClick}
        className="hover-underline"
      >
        {props.teamname}
      </Kb.Text>
      <Kb.Text type="BodyTiny">• System message</Kb.Text>
    </Kb.Box2>
    {!Styles.isMobile && !props.deactivateButtons && (
      <Kb.Icon type="iconfont-close" onClick={props.onDismiss} fontSize={12} />
    )}
  </Kb.Box2>
)

export default TeamJourney
