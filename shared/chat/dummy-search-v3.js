// @flow
import React from 'react'
import flags from '../util/feature-flags'
import {Box, Text, Button} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import {connect} from 'react-redux'
import {setInboxFilter} from '../actions/chat/creators'

import type {TypedState} from '../constants/reducer'

const _DummySearchV3 = flags.searchv3Enabled
  ? ({inboxFilter, setInboxFilter}) => {
      return (
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            position: 'absolute',
            flexWrap: 'wrap',
            right: 100,
            top: 0,
            width: 300,
            height: 250,
            backgroundColor: globalColors.yellow,
          }}
        >
          <Text type="Header">Bubbles: {inboxFilter.join(', ') || '(none)'}</Text>
          {[['cnojima4'], ['kbot', 'cctester102'], ['chris'], []].map(vals => (
            <Button
              key={vals.join(', ')}
              type="Primary"
              onClick={() => setInboxFilter(vals)}
              label={vals.join(', ') || '(none)'}
              style={{marginTop: 10}}
            />
          ))}
        </Box>
      )
    }
  : null

const mapStateToProps = (state: TypedState) => ({inboxFilter: state.chat.get('inboxFilter').toArray()})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  setInboxFilter: filter => dispatch(setInboxFilter(filter)),
})

const DummySearchV3 = _DummySearchV3
  ? connect(mapStateToProps, mapDispatchToProps)(_DummySearchV3)
  : () => null

export default DummySearchV3
