// @flow
import MenuList from '../settings/menu-list'
import React from 'react'
import engine from '../engine'
import {BackButton, Box} from '../common-adapters'
import {connect} from 'react-redux'
import {globalStyles} from '../styles'
import {logout} from '../actions/login/creators'
import {navigateAppend, navigateUp} from '../actions/route-tree'

function DevMenu (props) {
  const menuItems = [
    {name: 'Dumb components', hasChildren: true, onClick: props.onDumbSheet},
    {name: 'Reset engine', onClick: props.onReset},
    {name: 'Sign Out', onClick: props.onSignOut},
  ]
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <BackButton onClick={() => props.onBack()} />
      <MenuList items={menuItems} />
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
  }))(DevMenu)
