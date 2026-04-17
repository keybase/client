import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'

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

const OutOfDate = () => {
  const outOfDate = useConfigState(s => s.outOfDate)
  const [mobileMessage, setMobileMessage] = React.useState('')
  const [mobileCritical, setMobileCritical] = React.useState(false)

  React.useEffect(() => {
    if (!C.isMobile) {
      return
    }

    const timeoutID = setTimeout(() => {
      C.ignorePromise(
        T.RPCGen.configGetUpdateInfo2RpcPromise({})
          .then(update => {
            switch (update.status) {
              case T.RPCGen.UpdateInfoStatus2.critical:
                setMobileCritical(true)
                setMobileMessage(update.critical.message)
                break
              default:
                setMobileCritical(false)
                setMobileMessage('')
            }
          })
          .catch(e => {
            logger.warn("Can't call critical check", e)
          })
      )
    }, 60_000) // don't bother checking during startup

    return () => {
      clearTimeout(timeoutID)
    }
  }, [])

  const onOpenAppStore = useConfigState(s => s.dispatch.openAppStore)
  const critical = C.isMobile ? mobileCritical : outOfDate.critical
  const message = C.isMobile ? mobileMessage : outOfDate.message

  return !critical ? null : (
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
