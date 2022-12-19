import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Props} from './participant-rekey.types'

const Row = (props: {username: string; onUsernameClicked: (s: string) => void}) => (
  <Kb.Box style={styles.row} onClick={() => props.onUsernameClicked(props.username)}>
    <Kb.Avatar
      username={props.username}
      size={48}
      style={{marginRight: Styles.globalMargins.small, padding: 4}}
    />
    <Kb.Box style={styles.innerRow}>
      <Kb.ConnectedUsernames inline={true} type="BodyBold" usernames={props.username} />
      <Kb.Text type="BodySmall" style={Styles.platformStyles({isElectron: {lineHeight: '17px'}})}>
        Can rekey this chat by opening the Keybase app.
      </Kb.Text>
    </Kb.Box>
  </Kb.Box>
)

const ParticipantRekey = ({rekeyers, onShowProfile: onUsernameClicked}: Props) => {
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxRow,
          backgroundColor: Styles.globalColors.red,
          justifyContent: 'center',
        }}
      >
        <Kb.Text
          negative={true}
          style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
          type="BodySemibold"
        >
          This conversation is waiting for a participant to open their Keybase app.
        </Kb.Text>
      </Kb.Box>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          flex: 1,
          justifyContent: 'center',
          marginLeft: 8,
          overflow: 'auto',
        }}
      >
        <Kb.Box>
          {rekeyers.map(username => (
            <Row key={username} username={username} onUsernameClicked={onUsernameClicked} />
          ))}
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          backgroundColor: Styles.globalColors.white,
          borderLeft: `1px solid ${Styles.globalColors.black_20}`,
          flex: 1,
          justifyContent: 'flex-start',
        },
      }),
      innerRow: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          borderBottom: `1px solid ${Styles.globalColors.black_10}`,
          flex: 1,
          justifyContent: 'center',
        },
      }),
      row: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxRow,
          ...Styles.desktopStyles.clickable,
          minHeight: 48,
        },
      }),
    } as const)
)

export default ParticipantRekey
