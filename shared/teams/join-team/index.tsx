import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  errorText: string
  success: boolean
  name: string
  successTeamName: string | null
  onBack: () => void
  onNameChange: () => void
  onSubmit: () => void
}

const JoinTeam = (props: Props) => (
  <Kb.Modal
    banners={[
      !!props.errorText && (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
        </Kb.Banner>
      ),
    ]}
    footer={{
      content: (
        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button
            fullWidth={true}
            label={props.success ? 'Okay' : 'Continue'}
            onClick={props.success ? props.onBack : props.onSubmit}
          />
        </Kb.ButtonBar>
      ),
    }}
    header={{
      leftButton:
        Styles.isMobile && !props.success ? (
          <Kb.Text type="BodyBigLink" onClick={props.onBack}>
            Cancel
          </Kb.Text>
        ) : null,
      title: 'Join a team',
    }}
    onClose={props.onBack}
  >
    {props.success ? (
      <Kb.Box2 alignItems="center" direction="horizontal" fullHeight={true} fullWidth={true}>
        <Kb.Box2 direction="vertical" style={styles.container}>
          <Kb.Icon
            style={styles.icon}
            type={Styles.isMobile ? 'icon-fancy-email-sent-192-x-64' : 'icon-fancy-email-sent-144-x-48'}
          />
          <Kb.Text center={true} type="Body">
            We sent a request to{' '}
            {props.successTeamName ? (
              <Kb.Text type="BodySemibold">{props.successTeamName}</Kb.Text>
            ) : (
              'the team'
            )}
            ’s admins. We will notify you as soon as they let you in!
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Kb.RoundedBox style={styles.roundedBox}>
          <Kb.PlainInput
            autoFocus={true}
            onChangeText={props.onNameChange}
            onEnterKeyDown={props.onSubmit}
            placeholder="Token or team name"
            value={props.name}
          />
        </Kb.RoundedBox>
        <Kb.Text type="BodySmall">Examples: keybasefriends, stellar.public, etc.</Kb.Text>
      </Kb.Box2>
    )}
  </Kb.Modal>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        minHeight: undefined,
      },
      container: {
        padding: Styles.globalMargins.small,
        width: '100%',
      },
      icon: Styles.platformStyles({
        common: {
          alignSelf: 'center',
          marginBottom: Styles.globalMargins.tiny,
        },
        isElectron: {
          height: 48,
          width: 144,
        },
        isMobile: {
          height: 64,
          width: 192,
        },
      }),
      roundedBox: {
        marginBottom: Styles.globalMargins.tiny,
      },
    } as const)
)

export default JoinTeam
