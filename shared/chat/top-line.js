// @flow
import React, {PureComponent} from 'react'
import {PlaintextUsernames, Box} from '../common-adapters'
import {globalStyles} from '../styles'

type Props = {
  participants: Array<string>,
  showBold: boolean,
  usernameColor: ?string,
}

class FilteredTopLine extends PureComponent<Props> {
  render() {
    const {participants, showBold, usernameColor} = this.props
    const boldOverride = showBold ? globalStyles.fontBold : null
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'flex-start',
          position: 'relative',
        }}
      >
        <Box
          style={{
            ...globalStyles.fillAbsolute,
            ...globalStyles.flexBoxRow,
            alignItems: 'center',
          }}
        >
          <PlaintextUsernames
            type="BodySemibold"
            containerStyle={{...boldOverride, color: usernameColor, paddingRight: 7}}
            users={participants.map(p => ({username: p}))}
            title={participants.join(', ')}
          />
        </Box>
      </Box>
    )
  }
}

export {FilteredTopLine}
