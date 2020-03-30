import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import {isAndroid, getSecureFlagSetting, setSecureFlagSetting} from '../constants/platform.native'

const Screenprotector = () => {
  const [secureFlag, setSecureFlag] = React.useState<undefined | boolean>(undefined)
  const getIsMounted = Kb.useMounted()

  React.useEffect(() => {
    getSecureFlagSetting().then(secureFlag => {
      getIsMounted() && setSecureFlag(secureFlag)
    })
  }, [getIsMounted])

  const changeSecureFlagOption = async (nextValue: boolean) => {
    setSecureFlag(nextValue)
    const success = await setSecureFlagSetting(nextValue)
    if (success && getIsMounted()) {
      setSecureFlag(nextValue)
    }
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

Screenprotector.navigationOptions = {
  header: undefined,
  title: 'Screen Protector',
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.small),
  },
}))

export default Screenprotector
