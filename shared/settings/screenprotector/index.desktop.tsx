import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'

let disableScreenshotInitialValue: boolean | undefined

const Screenprotector = () => {
  const [disableScreenshot, setDisableScreenshot] = React.useState<boolean | undefined>(undefined)
  const loadDisableScreenshot = C.useRPC(T.RPCGen.configGuiGetValueRpcPromise)

  React.useEffect(() => {
    // load it
    if (disableScreenshot === undefined) {
      loadDisableScreenshot(
        [{path: 'ui.disableScreenshot'}],
        result => {
          const res = result.b ?? false
          setDisableScreenshot(res)
          if (disableScreenshotInitialValue === undefined) {
            disableScreenshotInitialValue = res
          }
        },
        () => {
          setDisableScreenshot(false)
          if (disableScreenshotInitialValue === undefined) {
            disableScreenshotInitialValue = false
          }
        }
      )
    }
  }, [disableScreenshot, loadDisableScreenshot])
  const submitDisableSpellcheck = C.useRPC(T.RPCGen.configGuiSetValueRpcPromise)

  const onToggleDisableScreenshot = () => {
    const next = !disableScreenshot
    setDisableScreenshot(next)
    submitDisableSpellcheck(
      [
        {
          path: 'ui.disableScreenshot',
          value: {b: next, isNull: false},
        },
      ],
      () => {},
      () => {
        console.log('cant save screenshot?')
        setDisableScreenshot(!next)
      }
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Checkbox
          label={
            'Disable screenshots' +
            (disableScreenshotInitialValue !== undefined &&
            disableScreenshotInitialValue !== disableScreenshot
              ? ' (restart required)'
              : '')
          }
          disabled={disableScreenshot === undefined}
          checked={!!disableScreenshot}
          onCheck={onToggleDisableScreenshot}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
  },
}))

export default Screenprotector
