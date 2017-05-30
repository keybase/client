// @flow
// This is a temp proxy for the searchv3 box to show the logic of it and the chat
import React from 'react'
import flags from '../util/feature-flags'
import {Box, Text, Button} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import {connect} from 'react-redux'
import * as Creators from '../actions/chat/creators'

import type {TypedState} from '../constants/reducer'

const _DummySearchV3 = ({inboxSearch, setInboxFilter}) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        backgroundColor: globalColors.yellow,
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        padding: 10,
        position: 'absolute',
        right: 100,
        top: 0,
        width: 300,
      }}
    >
      <Text type="Header" style={{width: '100%'}}>Bubbles: {inboxSearch.join(', ') || '(none)'}</Text>
      {[['cnojima4'], ['kbot', 'cctester102'], ['chris'], []].map(vals => (
        <Button
          key={vals.join(', ')}
          type="Primary"
          onClick={() => setInboxFilter(vals)}
          label={vals.join(', ') || '(none)'}
          style={{marginTop: 10, alignSelf: 'flex-start'}}
        />
      ))}
      <Button
        key="addrandom"
        type="Primary"
        onClick={() => {
          const users = ['chris', 'cjb', 'max', 'jzila', 'zanderz']
          const user = users[Math.floor(Math.random() * users.length)]
          setInboxFilter(inboxSearch.concat(user))
        }}
        label="add random"
        style={{marginTop: 10, alignSelf: 'flex-start'}}
      />
      <Button
        key="removelast"
        type="Primary"
        onClick={() => {
          setInboxFilter(inboxSearch.slice(0, inboxSearch.length - 1))
        }}
        label="remove last"
        style={{marginTop: 10, alignSelf: 'flex-start'}}
      />
    </Box>
  )
}

const mapStateToProps = (state: TypedState) => ({inboxSearch: state.chat.get('inboxSearch').toArray()})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  setInboxFilter: filter => {
    dispatch(Creators.setInboxFilter(filter))
    dispatch(Creators.setInboxSearch(filter))
  },
})

const DummySearchV3 = flags.searchv3Enabled
  ? connect(mapStateToProps, mapDispatchToProps)(_DummySearchV3)
  : () => null

export default DummySearchV3
