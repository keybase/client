import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {PgpMobileUnsupported} from './choice'

export default function Import() {
  const styles = useStyles()
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }

  if (isMobile) {
    return <PgpMobileUnsupported />
  }

  return (
    <Kb.ModalScreen footer={<Kb.Button type="Dim" label="Cancel" onClick={onCancel} fullWidth={true} />}>
      <Kb.ImageIcon type="icon-pgp-key-import-48" style={styles.icon} />
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
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      body: {
        ...Kb.Styles.marginV(Kb.Styles.globalMargins.small),
      },
      icon: {alignSelf: 'center'},
      terminal: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: theme.blueDarker2,
          borderRadius: Kb.Styles.borderRadius,
          color: theme.white,
          padding: Kb.Styles.globalMargins.small,
          textAlign: 'left',
        } as const,
      }),
    }) as const
)
