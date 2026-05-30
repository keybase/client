import * as Kb from '@/common-adapters'
import type {Props} from './participant-rekey.types'

const Row = ({username, onUsernameClicked}: {username: string; onUsernameClicked: (s: string) => void}) => (
  <Kb.ClickableBox3 direction="horizontal" alignItems={isMobile ? 'center' : undefined} style={styles.row} onClick={() => onUsernameClicked(username)}>
    <Kb.Avatar
      username={username}
      size={48}
      style={{marginRight: Kb.Styles.globalMargins.small, padding: 4}}
    />
    <Kb.Box2
      direction="vertical"
      justifyContent={isMobile ? 'center' : undefined}
      flex={isMobile ? 1 : undefined}
      style={styles.innerRow}
    >
      <Kb.ConnectedUsernames
        inline={true}
        backgroundMode={isMobile ? 'Terminal' : undefined}
        type="BodyBold"
        usernames={username}
      />
      <Kb.Text
        type="BodySmall"
        negative={isMobile}
        style={Kb.Styles.platformStyles({
          isElectron: {lineHeight: '17px'},
          isMobile: {color: Kb.Styles.globalColors.blueLighter_40, lineHeight: 17},
        })}
      >
        Can rekey this chat by opening the Keybase app.
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox3>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    justifyContent={isMobile ? 'flex-start' : undefined}
    flex={isMobile ? 1 : undefined}
    style={styles.container}
  >
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      justifyContent="center"
      style={{backgroundColor: Kb.Styles.globalColors.red}}
    >
      <Kb.Text
        center={isMobile}
        negative={true}
        style={{...Kb.Styles.padding(8, 24)}}
        type="BodySemibold"
      >
        This conversation is waiting for a participant to open their Keybase app.
      </Kb.Text>
    </Kb.Box2>
    <Kb.ScrollView style={styles.scroll}>
      <Kb.Box2 direction="vertical" fullWidth={true} justifyContent="center" style={styles.scrollInner}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.white,
      borderLeft: `1px solid ${Kb.Styles.globalColors.black_20}`,
      flex: 1,
      justifyContent: 'flex-start',
    },
    isMobile: {
      backgroundColor: Kb.Styles.globalColors.blueDarker2,
    },
  }),
  innerRow: Kb.Styles.platformStyles({
    isElectron: {
      borderBottom: `1px solid ${Kb.Styles.globalColors.black_10}`,
      flex: 1,
      justifyContent: 'center',
    },
    isMobile: {
      borderBottomColor: Kb.Styles.globalColors.black_10,
      borderBottomWidth: 1,
      minHeight: 56,
    },
  }),
  row: Kb.Styles.platformStyles({
    common: {
      minHeight: 48,
    },
    isMobile: {
      minHeight: 56,
    },
  }),
  scroll: Kb.Styles.platformStyles({
    isElectron: {overflow: 'auto' as const},
    isMobile: {flex: 1, paddingTop: 8},
  }),
  scrollInner: Kb.Styles.platformStyles({
    isElectron: {flex: 1, marginLeft: 8},
    isMobile: {marginLeft: 8},
  }),
}))

export default ParticipantRekey
