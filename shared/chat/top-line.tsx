import React, {PureComponent} from 'react'
import {PlaintextUsernames, Box, Text} from '../common-adapters'
import {globalStyles} from '../styles'
import {pluralize} from '../util/string'

type Props = {
  numSearchHits?: number
  maxSearchHits?: number
  participants: Array<string>
  showBold: boolean
  usernameColor: string | null
}

class FilteredTopLine extends PureComponent<Props> {
  _getSearchHits = () => {
    if (!this.props.numSearchHits) {
      return ''
    }
    if (this.props.maxSearchHits) {
      return this.props.numSearchHits >= this.props.maxSearchHits
        ? `${this.props.numSearchHits}+`
        : `${this.props.numSearchHits}`
    }
    return `${this.props.numSearchHits}`
  }
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
            <Text type="BodySmall">
              {this._getSearchHits()} {pluralize('result', this.props.numSearchHits)}
            </Text>
          )}
        </Box>
      </Box>
    )
  }
}

export {FilteredTopLine}
