import * as Kb from '@/common-adapters'
import type * as React from 'react'
import DeviceList from './device-list.desktop'
import DragHeader from '../desktop/remote/drag-header.desktop'
import PaperKeyInput from './paper-key-input.desktop'
import Success from './success.desktop'
import type * as Constants from '@/stores/unlock-folders'
import type {State as ConfigStore} from '@/stores/config'

export type Props = {
  phase: Constants.State['phase']
  devices: ConfigStore['unlockFoldersDevices']
  onClose: () => void
  toPaperKeyInput: () => void
  onBackFromPaperKey: () => void
  onContinueFromPaperKey: (paperkey: string) => void
  paperkeyError: string
  waiting: boolean
  onFinish: () => void
}

const UnlockFolders = (props: Props) => {
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
    <div style={styles.container}>
      <div style={styles.header}>
        <DragHeader icon={true} type="Default" title="" onClose={props.onClose} />
      </div>
      {innerComponent}
    </div>
  )
}

const styles = Kb.Styles.styleSheetCreate(
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
    }) as const
)

export default UnlockFolders
