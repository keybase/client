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
  onComplete: (role: TeamRoleType, sendNotification: boolean) => void,
  selectedRole?: TeamRoleType,
  allowOwner?: boolean,
  allowAdmin?: boolean,
  showNotificationCheckbox?: boolean,
  sendNotificationChecked?: boolean,
}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const currentType = routeProps.get('selectedRole')
  const _onComplete = routeProps.get('onComplete')
  const allowAdmin = routeProps.get('allowAdmin')
  const allowOwner = routeProps.get('allowOwner')
  const sendNotificationChecked = routeProps.get('sendNotificationChecked')
  const showSendNotification = routeProps.get('showNotificationCheckbox')
  return {
    _onComplete,
    allowAdmin,
    allowOwner,
    confirm: false,
    controlled: true,
    currentType,
    sendNotificationChecked,
    showSendNotification,
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
  withState('sendNotification', 'setSendNotification', props => props.sendNotificationChecked),
  withHandlers({
    setConfirm: ({_onComplete, onBack, selectedRole, sendNotification}) => (confirm: boolean) => {
      _onComplete(selectedRole, sendNotification)
      onBack()
    },
  })
)(isMobile ? HeaderHoc(ControlledRolePicker) : PopupWrapped)
