import * as Kb from '@/common-adapters'
import type {Props} from './participant-rekey.types'

const Row = (props: {username: string; onUsernameClicked: (s: string) => void}) => (
  <Kb.ClickableBox onClick={() => props.onUsernameClicked(props.username)}>
    <Kb.Box2 direction="horizontal" style={styles.row}>
      <Kb.Avatar
        username={props.username}
        size={48}
        style={{marginRight: Kb.Styles.globalMargins.small, padding: 4}}
      />
      <Kb.Box2 direction="vertical" style={styles.innerRow}>
        <Kb.ConnectedUsernames inline={true} type="BodyBold" usernames={props.username} />
        <Kb.Text3 type="BodySmall" style={Kb.Styles.platformStyles({isElectron: {lineHeight: '17px'}})}>
          Can rekey this chat by opening the Keybase app.
        </Kb.Text3>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={{
          backgroundColor: Kb.Styles.globalColors.red,
          justifyContent: 'center',
        }}
      >
        <Kb.Text3
          negative={true}
          style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
          type="BodySemibold"
        >
          This conversation is waiting for a participant to open their Keybase app.
        </Kb.Text3>
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.platformStyles({
          isElectron: {
            flex: 1,
            justifyContent: 'center',
            marginLeft: 8,
            overflow: 'auto',
          },
        })}
      >
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          borderLeft: `1px solid ${Kb.Styles.globalColors.black_20}`,
          flex: 1,
          justifyContent: 'flex-start',
        },
      }),
      innerRow: Kb.Styles.platformStyles({
        isElectron: {
          borderBottom: `1px solid ${Kb.Styles.globalColors.black_10}`,
          flex: 1,
          justifyContent: 'center',
        },
      }),
      row: Kb.Styles.platformStyles({
        isElectron: {
          minHeight: 48,
        },
      }),
    }) as const
)

export default ParticipantRekey
