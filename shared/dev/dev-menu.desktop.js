// @flow
import * as LoginGen from '../actions/login-gen'
import * as React from 'react'
import engine from '../engine'
import {BackButton, Box, Text} from '../common-adapters'
import {connect, type Dispatch} from '../util/container'
import {globalStyles, globalColors} from '../styles'
import {navigateUp} from '../actions/route-tree'

function DevMenu(props) {
  const menuItems = [
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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onReset: () => engine().reset(),
  onSignOut: () => dispatch(LoginGen.createLogout()),
  onBack: () => dispatch(navigateUp()),
})
export default connect(() => ({}), mapDispatchToProps)(DevMenu)
