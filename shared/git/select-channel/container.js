// @flow
import * as React from 'react'
import * as GitGen from '../../actions/git-gen'
import {PopupDialog, HeaderHoc} from '../../common-adapters'
import {connect} from 'react-redux'
import SelectChannel from '.'
import {isMobile} from '../../constants/platform'

export type SelectChannelProps = {
  teamname: string,
  repoID: string,
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onClose: () => dispatch(navigateUp()),
})

const PopupWrapped = props => (
  <PopupDialog onClose={props.onCancel}>
    <SelectChannel {...props} />
  </PopupDialog>
)

export default connect(() => ({}), mapDispatchToProps)(isMobile ? HeaderHoc(SelectChannel) : PopupWrapped)
