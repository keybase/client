// @flow
import React, {PureComponent} from 'react'
import {PlaintextUsernames, Box, Text} from '../common-adapters'
import {globalStyles} from '../styles'

type Props = {
  numSearchHits?: number,
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
            ...globalStyles.flexBoxColumn,
          }}
        >
          <PlaintextUsernames
            type="BodySemibold"
            containerStyle={{...boldOverride, color: usernameColor, paddingRight: 7}}
            users={participants.map(p => ({username: p}))}
            title={participants.join(', ')}
          />
          {!!this.props.numSearchHits && (
            <Text type="BodySmall">{this.props.numSearchHits} Message Hits</Text>
          )}
        </Box>
      </Box>
    )
  }
}

export {FilteredTopLine}
