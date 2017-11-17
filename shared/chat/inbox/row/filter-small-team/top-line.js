// @flow
import React, {PureComponent} from 'react'
import {PlaintextUsernames, Box} from '../../../../common-adapters'
import {globalStyles} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'
import {List} from 'immutable'

const height = isMobile ? 19 : 17

type Props = {
  participants: List<string>,
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
          maxHeight: height,
          minHeight: height,
          position: 'relative',
        }}
      >
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            bottom: 0,
            justifyContent: 'flex-start',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        >
          <PlaintextUsernames
            type="BodySemibold"
            containerStyle={{...boldOverride, color: usernameColor, paddingRight: 7}}
            users={participants.map(p => ({username: p})).toArray()}
            title={participants.join(', ')}
          />
        </Box>
      </Box>
    )
  }
}

export {FilteredTopLine}
