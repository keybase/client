import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import type {Props} from './participant-rekey.types'

const Row = ({username, onUsernameClicked}: {username: string; onUsernameClicked: (s: string) => void}) => (
  <Kb.ClickableBox onClick={() => onUsernameClicked(username)}>
    <Kb.Box style={styles.row}>
      <Kb.Avatar
        username={username}
        size={48}
        style={{marginRight: Styles.globalMargins.small, padding: 4}}
      />
      <Kb.Box style={styles.innerRow}>
        <Kb.ConnectedUsernames inline={true} backgroundMode="Terminal" type="BodyBold" usernames={username} />
        <Kb.Text
          type="BodySmall"
          negative={true}
          style={{color: Styles.globalColors.blueLighter_40, lineHeight: 17} as any}
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
        ...Styles.globalStyles.flexBoxRow,
        backgroundColor: Styles.globalColors.red,
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
    <Kb.NativeScrollView style={{flex: 1, paddingTop: 8}}>
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 8}}>
        <Kb.Box>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Kb.Box>
      </Kb.Box>
    </Kb.NativeScrollView>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        backgroundColor: Styles.globalColors.blueDarker2,
        flex: 1,
        justifyContent: 'flex-start',
      },
      innerRow: {
        ...Styles.globalStyles.flexBoxColumn,
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: 1,
        flex: 1,
        justifyContent: 'center',
        minHeight: 56,
      },
      row: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          minHeight: 56,
        },
        isElectron: {
          ...Styles.desktopStyles.clickable,
        },
      }),
    } as const)
)

export default ParticipantRekey
