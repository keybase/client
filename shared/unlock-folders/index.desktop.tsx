import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import {_setDarkModePreference} from '../styles/dark-mode'
import DeviceList from './device-list.desktop'
import PaperKeyInput from './paper-key-input.desktop'
import Success from './success.desktop'
import {State, _Device} from '../constants/types/unlock-folders'

export type Props = {
  darkMode: boolean
  phase: State['phase']
  devices: Array<_Device>
  onClose: () => void
  toPaperKeyInput: () => void
  onBackFromPaperKey: () => void
  onContinueFromPaperKey: (paperkey: string) => void
  paperkeyError: string | null
  waiting: boolean
  onFinish: () => void
}

const UnlockFolders = (props: Props) => {
  _setDarkModePreference(props.darkMode ? 'alwaysDark' : 'alwaysLight')

  let innerComponent: React.ReactNode

  switch (props.phase) {
    case 'dead':
    case 'promptOtherDevice':
      innerComponent = <DeviceList devices={props.devices} toPaperKeyInput={props.toPaperKeyInput} />
      break
    case 'paperKeyInput':
      innerComponent = (
        <PaperKeyInput
          onBack={props.onBackFromPaperKey}
          onContinue={props.onContinueFromPaperKey}
          paperkeyError={props.paperkeyError}
          waiting={props.waiting}
        />
      )
      break
    case 'success':
      innerComponent = <Success onClose={props.onClose} />
      break
  }

  return (
    <div
      style={styles.container}
      className={props.darkMode ? 'darkMode' : ''}
      key={props.darkMode ? 'darkMode' : 'light'}
    >
      <div style={styles.header}>
        <Kb.Header icon={true} type="Default" title="" onClose={props.onClose} />
      </div>
      {innerComponent}
    </div>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        height: 300,
        position: 'relative',
        width: 500,
      },

      header: {
        position: 'absolute',
        width: '100%',
      },
    } as const)
)

export default UnlockFolders
