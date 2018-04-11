// @flow
import * as React from 'react'
import Box from './box'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {globalColors, globalMargins, globalStyles} from '../styles'

type SaveState = 'same' | 'saving' | 'justSaved'

type Props = {
  // TODO: Remove.
  saveState: SaveState,
}

type State = {
  saveState: SaveState,
}

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: globalMargins.medium,
  justifyContent: 'center',
}

class SaveIndicator extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {saveState: 'same'}
  }

  render() {
    switch (this.state.saveState) {
      case 'same':
        return null
      case 'saving':
        return <ProgressIndicator style={{alignSelf: 'center', width: globalMargins.medium}} />
      case 'justSaved':
        return (
          <Box style={containerStyle}>
            <Icon type="iconfont-check" style={{color: globalColors.green}} />
            <Text type="BodySmall" style={{color: globalColors.green2}}>
              &nbsp; Saved
            </Text>
          </Box>
        )
    }
  }
}

export type {SaveState}
export default SaveIndicator
