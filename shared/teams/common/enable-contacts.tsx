import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'

/**
 * Popup explaining that Keybase doesn't have contact permissions with a link to
 * app permissions settings.
 * @param noAccess Whether we've been denied contact permissions permanently and
 * the user needs to correct it in settings.
 * @param onClose What to do on close button click in addition to closing this
 * popup.
 */
const EnableContactsPopup = ({noAccess, onClose}: {noAccess: boolean; onClose: () => void}) => {
  const dispatch = Container.useDispatch()
  const onOpenSettings = () => dispatch(ConfigGen.createOpenAppSettings())

  const [showingPopup, setShowingPopup] = React.useState(noAccess)
  React.useEffect(() => {
    setShowingPopup(noAccess)
  }, [noAccess])
  const onClosePopup = () => {
    setShowingPopup(false)
    onClose()
  }

  return showingPopup ? (
    <Kb.MobilePopup>
      <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="Header" style={styles.header}>
            Enable contact sync
          </Kb.Text>
          <Kb.Text type="Body">
            You previously disallowed syncing your phone contacts with Keybase. To re-allow it, go to your
            phone settings under Keybase.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Button label="Open phone settings" onClick={onOpenSettings} fullWidth={true} />
          <Kb.Button label="Close" type="Dim" onClick={onClosePopup} fullWidth={true} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.MobilePopup>
  ) : null
}

const styles = Styles.styleSheetCreate(() => ({
  container: {padding: Styles.globalMargins.small},
  header: {marginBottom: 6},
}))

export default EnableContactsPopup
