import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as React from 'react'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'

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

type Status = 'critical' | 'suggested' | 'ok' | 'checking'
export default () => {
  const [message, setMessage] = React.useState('')
  const [status, setStatus] = React.useState<Status>('ok')

  Container.useOnMountOnce(() => {
    const f = async () => {
      await Container.timeoutPromise(60_000) // don't bother checking during startup
      // check every hour
      // eslint-disable-next-line
      while (true) {
        try {
          const update = await RPCTypes.configGetUpdateInfo2RpcPromise({})
          let s: typeof status = 'ok'
          let m = ''
          switch (update.status) {
            case RPCTypes.UpdateInfoStatus2.ok:
              break
            case RPCTypes.UpdateInfoStatus2.suggested:
              s = 'suggested'
              m = update.suggested.message
              break
            case RPCTypes.UpdateInfoStatus2.critical:
              s = 'critical'
              m = update.critical.message
              break
            default:
          }
          setStatus(s)
          setMessage(m)
        } catch (e) {
          logger.warn("Can't call critical check", e)
        }
        // We just need this once on mobile. Long timers don't work there.
        if (Container.isMobile) {
          break
        }
        await Container.timeoutPromise(3_600_000) // 1 hr
      }
    }
    Container.ignorePromise(f())
  })

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
