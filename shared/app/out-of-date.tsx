import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.globalStyles.fillAbsolute,
    backgroundColor: Kb.Styles.globalColors.red,
    bottom: undefined,
    padding: Kb.Styles.globalMargins.small,
    zIndex: 9999,
  },
  messageContainer: {
    backgroundColor: Kb.Styles.globalColors.white_90,
    borderRadius: Kb.Styles.borderRadius,
    padding: Kb.Styles.globalMargins.medium,
  },
}))

type Status = 'critical' | 'suggested' | 'ok' | 'checking'
const OutOfDate = () => {
  const [message, setMessage] = React.useState('')
  const [status, setStatus] = React.useState<Status>('ok')

  C.useOnMountOnce(() => {
    const f = async () => {
      await C.timeoutPromise(60_000) // don't bother checking during startup
      // check every hour
      while (true) {
        try {
          const update = await T.RPCGen.configGetUpdateInfo2RpcPromise({})
          let s: typeof status = 'ok'
          let m = ''
          switch (update.status) {
            case T.RPCGen.UpdateInfoStatus2.ok:
              break
            case T.RPCGen.UpdateInfoStatus2.suggested:
              s = 'suggested'
              m = update.suggested.message
              break
            case T.RPCGen.UpdateInfoStatus2.critical:
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
        if (C.isMobile) {
          break
        }
        await C.timeoutPromise(3_600_000) // 1 hr
      }
    }
    C.ignorePromise(f())
  })

  const onOpenAppStore = C.useConfigState(s => s.dispatch.dynamic.openAppStore)

  return status !== 'critical' ? null : (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.container}>
      <Kb.Text center={true} type="Header" negative={true}>
        Your version of Keybase is critically out of date!
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.messageContainer} fullWidth={true}>
        <Kb.Markdown>{message}</Kb.Markdown>
      </Kb.Box2>
      {Kb.Styles.isMobile && <Kb.Button label="Update" onClick={onOpenAppStore} />}
    </Kb.Box2>
  )
}
export default OutOfDate
