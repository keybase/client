// @flow
import React from 'react'
import engine from '../engine'
import {BackButton, Box, Text} from '../common-adapters'
import {connect} from 'react-redux'
import {globalStyles, globalColors} from '../styles'
import {logout} from '../actions/login/creators'
import {navigateAppend, navigateUp} from '../actions/route-tree'

function DevMenu(props) {
  const menuItems = [
    {name: 'Dumb components', hasChildren: true, onClick: props.onDumbSheet},
    {name: 'Reset engine', onClick: props.onReset},
    {name: 'Sign Out', onClick: props.onSignOut},
  ]
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <BackButton onClick={() => props.onBack()} />
      <Box>
        {menuItems.map(m => (
          <Box
            key={m.name}
            onClick={m.onClick}
            style={{padding: 10, borderBottom: `1px solid ${globalColors.lightGrey}`}}
          >
            <Text type="Header">{m.name}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// $FlowIssue
export default connect(
  state => ({}),
  dispatch => ({
    onReset: () => engine().reset(),
    onSignOut: () => dispatch(logout()),
    onBack: () => dispatch(navigateUp()),
    onDumbSheet: () => dispatch(navigateAppend(['dumbSheet'])),
  })
)(DevMenu)
