import * as Kb from '@/common-adapters'
import NativeScrollView from '@/common-adapters/scroll-view.native'
import type {Props} from './participant-rekey.types'

const Row = ({username, onUsernameClicked}: {username: string; onUsernameClicked: (s: string) => void}) => (
  <Kb.ClickableBox onClick={() => onUsernameClicked(username)}>
    <Kb.Box2 direction="horizontal" alignItems="center" style={styles.row}>
      <Kb.Avatar
        username={username}
        size={48}
        style={{marginRight: Kb.Styles.globalMargins.small, padding: 4}}
      />
      <Kb.Box2 direction="vertical" style={styles.innerRow}>
        <Kb.ConnectedUsernames inline={true} backgroundMode="Terminal" type="BodyBold" usernames={username} />
        <Kb.Text3
          type="BodySmall"
          negative={true}
          style={{color: Kb.Styles.globalColors.blueLighter_40, lineHeight: 17}}
        >
          Can rekey this chat by opening the Keybase app.
        </Kb.Text3>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => (
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
        center={true}
        negative={true}
        style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
        type="BodySemibold"
      >
        This conversation is waiting for a participant to open their Keybase app.
      </Kb.Text3>
    </Kb.Box2>
    <NativeScrollView style={{flex: 1, paddingTop: 8}}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={{justifyContent: 'center', marginLeft: 8}}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    </NativeScrollView>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blueDarker2,
        flex: 1,
        justifyContent: 'flex-start',
      },
      innerRow: {
        borderBottomColor: Kb.Styles.globalColors.black_10,
        borderBottomWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 56,
      },
      row: Kb.Styles.platformStyles({
        common: {
          minHeight: 56,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.clickable,
        },
      }),
    }) as const
)

export default ParticipantRekey
