import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'

const Screenprotector = () => {
  const [disableScreenshot, setDisableScreenshot] = React.useState<boolean | undefined>(undefined)
  const initialDisableScreenshot = React.useRef<boolean | undefined>(undefined)
  const loadDisableScreenshot = C.useRPC(T.RPCGen.configGuiGetValueRpcPromise)

  // load it
  if (disableScreenshot === undefined) {
    setTimeout(() => {
      loadDisableScreenshot(
        [{path: 'ui.disableScreenshot'}],
        result => {
          const res = result.b ?? false
          initialDisableScreenshot.current = res
          setDisableScreenshot(res)
        },
        () => {
          initialDisableScreenshot.current = false
          setDisableScreenshot(false)
        }
      )
    }, 1)
  }
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
            (initialDisableScreenshot.current === disableScreenshot ? '' : ' (restart required)')
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
