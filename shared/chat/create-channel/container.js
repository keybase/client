// @flow
import {connect} from 'react-redux'
import * as React from 'react'
import {Box, Button} from '../../common-adapters'
import {globalStyles} from '../../styles'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onClose: () => dispatch(navigateUp()),
})

const TEMP = ({onClose}) => (
  <Box style={{...globalStyles.fillAbsolute, backgroundColor: 'white'}}>
    <Button type="Primary" onClick={onClose} label="TODO create channel" />
  </Box>
)

export default connect(mapStateToProps, mapDispatchToProps)(TEMP)
