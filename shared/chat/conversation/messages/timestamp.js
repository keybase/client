// @flow
import React, {Component} from 'react'
import shallowEqual from 'shallowequal'
import {Text, Box} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'

export type Props = {
  timestamp: string,
  style: Object,
}

class Timestamp extends Component<void, Props, void> {
  shouldComponentUpdate (nextProps: Props, nextState: any): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'style') {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render () {
    const {timestamp, style} = this.props
    return <Box style={{...globalStyles.flexBoxRow, ...style}}>
      <Text style={styleText} type='BodySmallSemibold'>{timestamp}</Text>
    </Box>
  }
}

export const styleText = {
  color: globalColors.black_40,
  flex: 1,
  padding: globalMargins.tiny,
  textAlign: 'center',
}
export default Timestamp
