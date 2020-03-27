import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'

const EnableContactsPopup = ({onClose}: {onClose: () => void}) => {
  const dispatch = Container.useDispatch()
  const onOpenSettings = () => dispatch(ConfigGen.createOpenAppSettings())
  return (
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
          <Kb.Button label="Close" type="Dim" onClick={onClose} fullWidth={true} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.MobilePopup>
  )
}

export const useEnableContactsPopup = (noAccess: boolean, onClose: () => void) => {
  // Whether we show the modal === whether we don't have contact permission
  // Except on hitting close we want it to dismiss immediately rather than
  // assume onClose will cause us to unmount.
  const [showingPopup, setShowingPopup] = React.useState(false)
  React.useEffect(() => {
    setShowingPopup(noAccess)
  }, [noAccess])
  const onClosePopup = () => {
    setShowingPopup(false)
    onClose()
  }
  return showingPopup ? <EnableContactsPopup onClose={onClosePopup} /> : null
}

const styles = Styles.styleSheetCreate(() => ({
  container: {padding: Styles.globalMargins.small},
  header: {marginBottom: 6},
}))

export default EnableContactsPopup
