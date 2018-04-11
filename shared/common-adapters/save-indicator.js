// @flow
import * as React from 'react'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import {globalColors, globalMargins} from '../styles'

type SaveState = 'same' | 'saving' | 'justSaved'

type Props = {
  saveState: SaveState,
}

const SaveIndicator = ({saveState}: Props) => {
  switch (saveState) {
    case 'same':
      return null
    case 'saving':
      return <ProgressIndicator style={{alignSelf: 'center', width: globalMargins.medium}} />
    case 'justSaved':
      return [
        <Icon key="0" type="iconfont-check" style={{color: globalColors.green}} />,
        <Text key="1" type="BodySmall" style={{color: globalColors.green2}}>
          &nbsp; Saved
        </Text>,
      ]
  }
}

export type {SaveState}
export default SaveIndicator
