// @flow
import React from 'react'
import {connect} from 'react-redux'
import {navigateUp} from '../actions/route-tree'
import {globalStyles} from '../styles'
import {PopupDialog, Text} from '../common-adapters'

function TestPopup({onClose}: {onClose: () => void}) {
  return (
    <PopupDialog onClose={onClose} styleContainer={{...globalStyles.flexBoxCenter, padding: 10, flex: 0}}>
      <Text type="Body">Hello, World!</Text>
    </PopupDialog>
  )
}

export default connect(null, (dispatch: Dispatch) => ({
  onClose: () => dispatch(navigateUp()),
}))(TestPopup)
