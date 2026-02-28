import * as Kb from '@/common-adapters'
import NativeScrollView from '@/common-adapters/scroll-view.native'
import type {Props} from './participant-rekey.types'

const Row = ({username, onUsernameClicked}: {username: string; onUsernameClicked: (s: string) => void}) => (
  <Kb.ClickableBox onClick={() => onUsernameClicked(username)}>
    <Kb.Box style={styles.row}>
      <Kb.Avatar
        username={username}
        size={48}
        style={{marginRight: Kb.Styles.globalMargins.small, padding: 4}}
      />
      <Kb.Box style={styles.innerRow}>
        <Kb.ConnectedUsernames inline={true} backgroundMode="Terminal" type="BodyBold" usernames={username} />
        <Kb.Text
          type="BodySmall"
          negative={true}
          style={{color: Kb.Styles.globalColors.blueLighter_40, lineHeight: 17}}
        >
          Can rekey this chat by opening the Keybase app.
        </Kb.Text>
      </Kb.Box>
    </Kb.Box>
  </Kb.ClickableBox>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.Box
      style={{
        ...Kb.Styles.globalStyles.flexBoxRow,
        backgroundColor: Kb.Styles.globalColors.red,
        justifyContent: 'center',
      }}
    >
      <Kb.Text
        center={true}
        negative={true}
        style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
        type="BodySemibold"
      >
        This conversation is waiting for a participant to open their Keybase app.
      </Kb.Text>
    </Kb.Box>
    <NativeScrollView style={{flex: 1, paddingTop: 8}}>
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 8}}>
        <Kb.Box>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Kb.Box>
      </Kb.Box>
    </NativeScrollView>
  </Kb.Box>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        backgroundColor: Kb.Styles.globalColors.blueDarker2,
        flex: 1,
        justifyContent: 'flex-start',
      },
      innerRow: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        borderBottomColor: Kb.Styles.globalColors.black_10,
        borderBottomWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 56,
      },
      row: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          minHeight: 56,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.clickable,
        },
      }),
    }) as const
)

export default ParticipantRekey
