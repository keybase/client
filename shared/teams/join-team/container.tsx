import * as C from '@/constants'
import upperFirst from 'lodash/upperFirst'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'
import * as Kb from '@/common-adapters'

type OwnProps = {initialTeamname?: string}

const Container = (ownProps: OwnProps) => {
  const initialTeamname = ownProps.initialTeamname
  const errorText = useTeamsState(s => upperFirst(s.errorInTeamJoin))
  const open = useTeamsState(s => s.teamJoinSuccessOpen)
  const success = useTeamsState(s => s.teamJoinSuccess)
  const successTeamName = useTeamsState(s => s.teamJoinSuccessTeamName)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const joinTeam = useTeamsState(s => s.dispatch.joinTeam)
  const onJoinTeam = joinTeam

  const [name, _setName] = React.useState(initialTeamname ?? '')
  const setName = (n: string) => _setName(n.toLowerCase())
  const resetTeamJoin = useTeamsState(s => s.dispatch.resetTeamJoin)
  React.useEffect(() => {
    resetTeamJoin()
  }, [resetTeamJoin])

  const onSubmit = () => {
    onJoinTeam(name)
  }

  return (
    <Kb.Modal
      banners={
        errorText ? (
          <Kb.Banner key="red" color="red">
            <Kb.BannerParagraph bannerColor="red" content={errorText} />
          </Kb.Banner>
        ) : null
      }
      footer={{
        content: (
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              fullWidth={true}
              label={success ? 'Close' : 'Continue'}
              onClick={success ? onBack : onSubmit}
              type={success ? 'Dim' : 'Default'}
              waitingKey={C.waitingKeyTeamsJoinTeam}
            />
          </Kb.ButtonBar>
        ),
      }}
      header={{
        hideBorder: success,
        leftButton:
          Kb.Styles.isMobile && !success ? (
            <Kb.Text type="BodyBigLink" onClick={onBack}>
              Cancel
            </Kb.Text>
          ) : null,
        title: success ? 'Request sent' : 'Join a team',
      }}
      onClose={onBack}
    >
      {success ? (
        <Kb.Box2 alignItems="center" direction="horizontal" fullHeight={true} fullWidth={true}>
          {open ? (
            <Success teamname={successTeamName} />
          ) : (
            <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true}>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
                <Kb.Icon type="icon-illustration-teams-zen-460-96" />
              </Kb.Box2>
              <Kb.Box style={styles.container}>
                <Kb.Text center={true} type="Body">
                  Your request was sent to the admins of{' '}
                  {successTeamName ? <Kb.Text type="BodySemibold">{successTeamName}</Kb.Text> : 'the team'}.
                  {"Hang tight, you'll get notified as soon as you're let in."}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: Kb.Styles.platformStyles({isElectron: {overflowX: 'hidden'}}),
      buttonBar: {minHeight: undefined},
      container: {
        padding: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      roundedBox: {marginBottom: Kb.Styles.globalMargins.tiny},
    }) as const
)

export default Container
