// @flow
import * as React from 'react'
import {BackButton, Box, Text} from '../common-adapters'
import {connect, type Dispatch} from '../util/container'
import {globalStyles, globalColors} from '../styles'
import {navigateUp} from '../actions/route-tree'

function DevMenu(props) {
  const menuItems = []
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
  onBack: () => dispatch(navigateUp()),
})
export default connect(
  () => ({}),
  mapDispatchToProps
)(DevMenu)
