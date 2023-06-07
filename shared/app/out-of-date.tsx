import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as React from 'react'

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.red,
    bottom: undefined,
    padding: Styles.globalMargins.small,
    zIndex: 9999,
  },
  messageContainer: {
    backgroundColor: Styles.globalColors.white_90,
    borderRadius: Styles.borderRadius,
    padding: Styles.globalMargins.medium,
  },
}))

export default () => {
  const message = Container.useSelector(state => state.config.appOutOfDateMessage)
  const status = Container.useSelector(state => state.config.appOutOfDateStatus)
  const dispatch = Container.useDispatch()
  const onOpenAppStore = React.useCallback(() => {
    dispatch(ConfigGen.createOpenAppStore())
  }, [dispatch])

  return status !== 'critical' ? null : (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.container}>
      <Kb.Text center={true} type="Header" negative={true}>
        Your version of Keybase is critically out of date!
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.messageContainer} fullWidth={true}>
        <Kb.Markdown>{message}</Kb.Markdown>
      </Kb.Box2>
      {Styles.isMobile && <Kb.Button label="Update" onClick={onOpenAppStore} />}
    </Kb.Box2>
  )
}
