import * as React from 'react'
import DeviceList from './device-list.desktop'
import PaperKeyInput from './paper-key-input.desktop'
import Success from './success.desktop'
import {Header} from '../common-adapters'
import {State, _Device} from '../constants/types/unlock-folders'
import * as Styles from '../styles'

export type Props = {
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

export default class UnlockFoldersRender extends React.Component<Props> {
  render() {
    let innerComponent

    switch (this.props.phase) {
      case 'dead':
      case 'promptOtherDevice':
        innerComponent = (
          <DeviceList devices={this.props.devices} toPaperKeyInput={this.props.toPaperKeyInput} />
        )
        break
      case 'paperKeyInput':
        innerComponent = (
          <PaperKeyInput
            onBack={this.props.onBackFromPaperKey}
            onContinue={this.props.onContinueFromPaperKey}
            paperkeyError={this.props.paperkeyError}
            waiting={this.props.waiting}
          />
        )
        break
      case 'success':
        innerComponent = <Success onClose={this.props.onClose} />
        break
    }

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <Header icon={true} type="Default" title="" onClose={this.props.onClose} />
        </div>
        {innerComponent}
      </div>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    height: 300,
    position: 'relative',
    width: 500,
  },

  header: {
    position: 'absolute',
    width: '100%',
  },
})
