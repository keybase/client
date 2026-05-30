import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import Modal from '@/profile/modal'
import {PgpMobileUnsupported} from '../choice'

export default function Import() {
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }

  if (isMobile) {
    return <PgpMobileUnsupported onCancel={onCancel} />
  }

  return (
    <Modal onCancel={onCancel}>
      <Kb.ImageIcon type="icon-pgp-key-import-48" />
      <Kb.Text style={styles.header} type="Header">
        Import a PGP key
      </Kb.Text>
      <Kb.Text style={styles.body} type="Body">
        To register your existing PGP public key on Keybase, please run the following command from your
        terminal:
      </Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.terminal}>
        <Kb.Text type="TerminalComment">{"# import a key from gpg's key chain"}</Kb.Text>
        <Kb.Text type="Terminal">keybase pgp select</Kb.Text>
        <Kb.Text type="TerminalEmpty" />
        <Kb.Text type="TerminalComment"># for more options</Kb.Text>
        <Kb.Text type="Terminal">keybase pgp help</Kb.Text>
      </Kb.Box2>
    </Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      body: {
        marginBottom: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
      },
      header: {
        marginTop: Kb.Styles.globalMargins.medium,
      },
      terminal: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blueDarker2,
          borderRadius: Kb.Styles.borderRadius,
          boxSizing: 'content-box',
          color: Kb.Styles.globalColors.white,
          marginLeft: -Kb.Styles.globalMargins.medium,
          marginRight: -Kb.Styles.globalMargins.medium,
          padding: Kb.Styles.globalMargins.medium,
          textAlign: 'left',
        } as const,
      }),
    }) as const
)
