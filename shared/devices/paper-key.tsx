import * as Constants from '../constants/devices'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import * as RPCTypes from '../constants/types/rpc-gen'

const PaperKey = () => {
  const [paperkey, setPaperkey] = React.useState('')
  const [wroteItDown, setWroteItDown] = React.useState(false)
  const dispatch = Container.useDispatch()

  Container.useOnMountOnce(() => {
    RPCTypes.loginPaperKeyRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.loginUi.promptRevokePaperKeys': (_, response) => {
            response.result(false)
            return false
          },
        },
        incomingCallMap: {
          'keybase.1.loginUi.displayPaperKeyPhrase': ({phrase}) => {
            setPaperkey(phrase)
          },
        },
        params: undefined,
        waitingKey: Constants.waitingKey,
      },
      Container.dummyListenerApi
    )
      .then(() => {})
      .catch(() => {})
  })

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
        style={styles.container}
        gap="medium"
      >
        <Kb.Text type="Header">Paper key generated!</Kb.Text>
        <Kb.Text type="Body" style={styles.intro}>
          Here is your unique paper key, it will allow you to perform important Keybase tasks in the future.
          This is the only time you'll see this so be sure to write it down.
        </Kb.Text>
        <Kb.Box2 direction="vertical" style={styles.keyBox} centerChildren={true} fullWidth={true}>
          {paperkey ? (
            <Kb.Text
              center={true}
              type="Header"
              selectable={true}
              style={styles.text}
              textBreakStrategy="simple"
            >
              {paperkey}
            </Kb.Text>
          ) : (
            <Kb.ProgressIndicator type="Large" />
          )}
        </Kb.Box2>
        <Kb.Checkbox
          label="Yes, I wrote this down."
          checked={wroteItDown}
          disabled={!paperkey}
          onCheck={setWroteItDown}
        />
        <Kb.WaitingButton
          label="Done"
          onClick={() => dispatch(RouteTreeGen.createClearModals())}
          disabled={!wroteItDown}
          waitingKey={Constants.waitingKey}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const borderWidth = 3

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'center',
        maxWidth: Styles.isMobile ? undefined : 560,
        padding: Styles.globalMargins.medium,
      },
      header: {position: 'absolute'},
      intro: {textAlign: 'center'},
      keyBox: {
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.blueDarker,
        borderRadius: borderWidth,
        borderStyle: 'solid',
        borderWidth,
        minHeight: 100,
        padding: Styles.globalMargins.medium,
      },
      text: {
        ...Styles.globalStyles.fontTerminal,
        color: Styles.globalColors.blueDark,
      },
    } as const)
)

export default PaperKey