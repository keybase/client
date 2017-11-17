// @flow
import * as React from 'react'
import {Text, Box, Icon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

type Props = {
  disabled: boolean,
  onConfirmedDelete: () => void,
}

type State = {}

class DeleteChannel extends React.Component<Props, State> {
  render() {
    const {disabled, onConfirmedDelete} = this.props
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          position: 'absolute',
          left: 0,
          opacity: disabled ? 0.5 : undefined,
        }}
      >
        <Icon
          type="iconfont-trash"
          style={{height: 14, color: globalColors.red, marginRight: globalMargins.tiny}}
        />
        <Text
          type={disabled ? 'Body' : 'BodyPrimaryLink'}
          style={{color: globalColors.red}}
          onClick={disabled ? undefined : onConfirmedDelete}
        >
          Delete Channel
        </Text>
      </Box>
    )
  }
}

export default DeleteChannel
