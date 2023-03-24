import * as TeamsGen from '../../actions/teams-gen'
import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  errorText: string
  initialTeamname?: string
  open: boolean
  success: boolean
  successTeamName: string | null
  onBack: () => void
  onJoinTeam: (name: string) => void
}

export const Success = (props: {teamname: string}) => (
  <Kb.Box2 alignItems="center" direction="vertical" gap="tiny" style={styles.container}>
    <Kb.Icon type="icon-illustration-welcome-96" />
    {!!props.teamname && (
      <Kb.Text center={true} type="Header">
        You’ve joined {props.teamname}!
      </Kb.Text>
    )}
    <Kb.Text center={true} type="Body">
      The team may take a tiny while to appear as an admin needs to come online. But you’re in.
    </Kb.Text>
  </Kb.Box2>
)

const JoinTeam = (props: Props) => {
  const [name, _setName] = React.useState(props.initialTeamname ?? '')
  const setName = (n: string) => _setName(n.toLowerCase())
  const dispatch = Container.useDispatch()

  React.useEffect(() => {
    dispatch(TeamsGen.createSetTeamJoinError({error: ''}))
    dispatch(TeamsGen.createSetTeamJoinSuccess({open: false, success: false, teamname: ''}))
  }, [dispatch])

  const onSubmit = () => {
    props.onJoinTeam(name)
  }

  return (
    <Kb.Modal
      banners={
        props.errorText ? (
          <Kb.Banner key="red" color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
          </Kb.Banner>
        ) : null
      }
      footer={{
        content: (
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              fullWidth={true}
              label={props.success ? 'Close' : 'Continue'}
              onClick={props.success ? props.onBack : onSubmit}
              type={props.success ? 'Dim' : 'Default'}
              waitingKey={Constants.joinTeamWaitingKey}
            />
          </Kb.ButtonBar>
        ),
      }}
      header={{
        hideBorder: props.success,
        leftButton:
          Styles.isMobile && !props.success ? (
            <Kb.Text type="BodyBigLink" onClick={props.onBack}>
              Cancel
            </Kb.Text>
          ) : null,
        title: props.success ? 'Request sent' : 'Join a team',
      }}
      onClose={props.onBack}
    >
      {props.success ? (
        <Kb.Box2 alignItems="center" direction="horizontal" fullHeight={true} fullWidth={true}>
          {props.open ? (
            <Success teamname={props.successTeamName ?? 'the team'} />
          ) : (
            <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true}>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
                <Kb.Icon type="icon-illustration-teams-zen-460-96" />
              </Kb.Box2>
              <Kb.Box style={styles.container}>
                <Kb.Text center={true} type="Body">
                  Your request was sent to the admins of{' '}
                  {props.successTeamName ? (
                    <Kb.Text type="BodySemibold">{props.successTeamName}</Kb.Text>
                  ) : (
                    'the team'
                  )}
                  . Hang tight, you'll get notified as soon as you're let in.
                </Kb.Text>
              </Kb.Box>
            </Kb.Box2>
          )}
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="vertical" style={styles.container}>
          <Kb.RoundedBox style={styles.roundedBox}>
            <Kb.PlainInput
              autoFocus={true}
              onChangeText={setName}
              onEnterKeyDown={onSubmit}
              placeholder="Token or team name"
              value={name}
            />
          </Kb.RoundedBox>
          <Kb.Text type="BodySmall">Examples: keybasefriends, stellar.public, etc.</Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: Styles.platformStyles({isElectron: {overflowX: 'hidden'}}),
      buttonBar: {minHeight: undefined},
      container: {
        padding: Styles.globalMargins.small,
        width: '100%',
      },
      roundedBox: {marginBottom: Styles.globalMargins.tiny},
    } as const)
)

export default JoinTeam
