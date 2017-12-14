// @flow

import React, {Component} from 'react'

import DeviceList from './device-list.desktop'
import PaperKeyInput from './paper-key-input.desktop'
import Success from './success.desktop'
import {Header} from '../common-adapters'
import type {State, _Device} from '../constants/types/unlock-folders'

export type Props = {
  phase: $PropertyType<State, 'phase'>,
  devices: Array<_Device>,
  onClose: () => void,
  toPaperKeyInput: () => void,
  onBackFromPaperKey: () => void,
  onContinueFromPaperKey: (paperkey: string) => void,
  paperkeyError: ?string,
  waiting: boolean,
  onFinish: () => void,
}

export default class UnlockFoldersRender extends Component<Props> {
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
            toPaperKeyInput={this.props.toPaperKeyInput}
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

const styles = {
  container: {
    position: 'relative',
    height: 300,
    width: 500,
  },

  header: {
    position: 'absolute',
    width: '100%',
  },
}
