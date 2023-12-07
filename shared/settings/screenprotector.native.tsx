import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {isAndroid, getSecureFlagSetting, setSecureFlagSetting} from '@/constants/platform.native'

const Screenprotector = () => {
  const [secureFlag, setSecureFlag] = React.useState<undefined | boolean>(undefined)
  const isMounted = C.useIsMounted()

  C.useOnMountOnce(() => {
    getSecureFlagSetting()
      .then(secureFlag => {
        isMounted() && setSecureFlag(secureFlag)
      })
      .then(() => {})
      .catch(() => {})
  })

  const changeSecureFlagOption = (nextValue: boolean) => {
    const f = async () => {
      setSecureFlag(nextValue)
      const success = await setSecureFlagSetting(nextValue)
      if (success && isMounted()) {
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
  },
}))

export default Screenprotector
