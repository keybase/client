import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {getSecureFlagSetting, setSecureFlagSetting} from '@/constants/platform'

let disableScreenshotInitialValue: boolean | undefined

const Screenprotector = () => {
  const [disableScreenshot, setDisableScreenshot] = React.useState<boolean | undefined>(undefined)
  const [secureFlag, setSecureFlag] = React.useState<undefined | boolean>(undefined)
  const loadDisableScreenshot = C.useRPC(T.RPCGen.configGuiGetValueRpcPromise)
  const submitDisableSpellcheck = C.useRPC(T.RPCGen.configGuiSetValueRpcPromise)

  C.useOnMountOnce(() => {
    if (!isMobile) return
    getSecureFlagSetting()
      .then(v => {
        setSecureFlag(v)
        return undefined
      })
      .catch(() => {})
  })

  React.useEffect(() => {
    if (isMobile) return
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

  if (isMobile) {
    const changeSecureFlagOption = (nextValue: boolean) => {
      const f = async () => {
        setSecureFlag(nextValue)
        const success = await setSecureFlagSetting(nextValue)
        if (success) {
          setSecureFlag(nextValue)
        }
      }
      C.ignorePromise(f())
    }

    if (!isAndroid) {
      return <Kb.Text type="Body">Screenprotector is only supported on Android</Kb.Text>
    }

    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.Checkbox
            label="Disable App switcher preview and screenshots"
            onCheck={changeSecureFlagOption}
            checked={!!secureFlag}
            disabled={secureFlag === undefined}
          />
        </Kb.Box2>
      </Kb.Box2>
    )
  }

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
    <Kb.Box2 direction="vertical" fullWidth={true} testID={TestIDs.SETTINGS_SCREENPROTECTOR}>
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
