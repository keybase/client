import * as Kb from '@/common-adapters'
import type {Props} from './participant-rekey.types'

const Row = ({username, onUsernameClicked}: {username: string; onUsernameClicked: (s: string) => void}) => (
  <Kb.ClickableBox onClick={() => onUsernameClicked(username)}>
    <Kb.Box2
      direction="horizontal"
      alignItems={Kb.Styles.isMobile ? 'center' : undefined}
      style={styles.row}
    >
      <Kb.Avatar
        username={username}
        size={48}
        style={{marginRight: Kb.Styles.globalMargins.small, padding: 4}}
      />
      <Kb.Box2
        direction="vertical"
        justifyContent={Kb.Styles.isMobile ? 'center' : undefined}
        flex={Kb.Styles.isMobile ? 1 : undefined}
        style={styles.innerRow}
      >
        <Kb.ConnectedUsernames
          inline={true}
          backgroundMode={Kb.Styles.isMobile ? 'Terminal' : undefined}
          type="BodyBold"
          usernames={username}
        />
        <Kb.Text
          type="BodySmall"
          negative={Kb.Styles.isMobile}
          style={Kb.Styles.platformStyles({
            isElectron: {lineHeight: '17px'},
            isMobile: {color: Kb.Styles.globalColors.blueLighter_40, lineHeight: 17},
          })}
        >
          Can rekey this chat by opening the Keybase app.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ClickableBox>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    justifyContent={Kb.Styles.isMobile ? 'flex-start' : undefined}
    flex={Kb.Styles.isMobile ? 1 : undefined}
    style={styles.container}
  >
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      justifyContent="center"
      style={{backgroundColor: Kb.Styles.globalColors.red}}
    >
      <Kb.Text
        center={Kb.Styles.isMobile}
        negative={true}
        style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
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
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
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
