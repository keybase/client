// @flow
import * as React from 'react'
import {connect} from '../util/container'
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

const mapDispatchToProps = dispatch => ({
  onClose: () => dispatch(navigateUp()),
})

export default connect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(TestPopup)
