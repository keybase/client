import * as Kb from '@/common-adapters'
import type * as React from 'react'
import DeviceList from './device-list.desktop'
import DragHeader from '../desktop/remote/drag-header.desktop'
import PaperKeyInput from './paper-key-input.desktop'
import Success from './success.desktop'
import type {UnlockFolderDevice} from './store'

type Phase = 'dead' | 'promptOtherDevice' | 'paperKeyInput' | 'success'

export type Props = {
  phase: Phase
  devices: ReadonlyArray<UnlockFolderDevice>
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
    <Kb.Box2 direction="vertical" relative={true} style={styles.container}>
      <Kb.Box2 direction="vertical" style={styles.header}>
        <DragHeader icon={true} type="Default" title="" onClose={props.onClose} />
      </Kb.Box2>
      {innerComponent}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        height: 300,
        width: 500,
      },

      header: {
        position: 'absolute',
        width: '100%',
      },
    }) as const
)

export default UnlockFolders
