// @flow
import React from 'react'
import {RoleOptions} from '.'
import {connect} from 'react-redux'
import {compose, withHandlers, withState} from 'recompose'
import {PopupDialog, HeaderHoc, ScrollView} from '../../common-adapters/index'
import {isMobile} from '../../constants/platform'
import {type TypedState} from '../../constants/reducer'
import {type TeamRoleType} from '../../constants/teams'

/* 
  Pass through via routeprops
  onComplete gets selected role
  selectedRole sets a default role for the component
  allowOwner specifies whether the user can choose the 'owner' option
*/
export type ControlledRolePickerProps = {
  onComplete: (role: TeamRoleType) => void,
  selectedRole?: TeamRoleType,
  allowOwner?: boolean,
  allowAdmin?: boolean,
}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const currentType = routeProps.get('selectedRole')
  const _onComplete = routeProps.get('onComplete')
  const allowAdmin = routeProps.get('allowAdmin')
  const allowOwner = routeProps.get('allowOwner')
  return {
    _onComplete,
    allowAdmin,
    allowOwner,
    confirm: false,
    controlled: true,
    currentType,
    sendNotification: false,
    setSendNotification: () => {},
    showSendNotification: false,
    username: '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
})

const ControlledRolePicker = props => (
  <ScrollView>
    <RoleOptions {...props} />
  </ScrollView>
)

const PopupWrapped = props => (
  <PopupDialog onClose={props.onBack}>
    <ControlledRolePicker {...props} />
  </PopupDialog>
)

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedRole', 'setSelectedRole', props => props.currentType),
  withHandlers({
    setConfirm: ({_onComplete, onBack, selectedRole}) => (confirm: boolean) => {
      _onComplete(selectedRole)
      onBack()
    },
  })
)(isMobile ? HeaderHoc(ControlledRolePicker) : PopupWrapped)
