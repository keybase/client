// @flow
import React from 'react'
import {RoleOptions} from '.'
import {connect} from 'react-redux'
import {compose, withHandlers, withStateHandlers} from '../../util/container'
import {PopupDialog, HeaderHoc, ScrollView} from '../../common-adapters/index'
import {isMobile} from '../../constants/platform'
import {type TypedState} from '../../constants/reducer'
import {type TeamRoleType} from '../../constants/types/teams'

/*
  Pass through via routeprops
  onComplete gets selected role
  selectedRole sets a default role for the component
  allowOwner specifies whether the user can choose the 'owner' option
  pluralizeRoleName speficifies whether to pluralize the role name or not
*/
export type ControlledRolePickerProps = {
  onComplete: (role: TeamRoleType, sendNotification: boolean) => void,
  selectedRole?: TeamRoleType,
  allowOwner?: boolean,
  allowAdmin?: boolean,
  pluralizeRoleName?: boolean,
  showNotificationCheckbox?: boolean,
  sendNotificationChecked?: boolean,
  styleCover?: Object,
}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const currentType = routeProps.get('selectedRole')
  const _onComplete = routeProps.get('onComplete')
  const allowAdmin = routeProps.get('allowAdmin')
  const allowOwner = routeProps.get('allowOwner')
  const pluralizeRoleName = routeProps.get('pluralizeRoleName')
  const sendNotificationChecked = routeProps.get('sendNotificationChecked')
  const showSendNotification = routeProps.get('showNotificationCheckbox')
  const styleCover = routeProps.get('styleCover')
  return {
    _onComplete,
    allowAdmin,
    allowOwner,
    confirm: false,
    controlled: true,
    currentType,
    pluralizeRoleName,
    sendNotificationChecked,
    showSendNotification,
    styleCover,
    username: '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
})

const ControlledRolePicker = props => (
  <ScrollView>
    <RoleOptions {...props} />
  </ScrollView>
)

const PopupWrapped = props => (
  <PopupDialog styleCover={props.styleCover} onClose={props.onCancel}>
    <ControlledRolePicker {...props} />
  </PopupDialog>
)

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  ),
  withStateHandlers(
    ({currentType, sendNotificationChecked}) => ({
      selectedRole: currentType,
      sendNotification: sendNotificationChecked,
    }),
    {
      setSelectedRole: () => selectedRole => ({selectedRole}),
      setSendNotification: () => sendNotification => ({sendNotification}),
    }
  ),
  withHandlers({
    setConfirm: ({_onComplete, onCancel, selectedRole, sendNotification}) => (confirm: boolean) => {
      _onComplete(selectedRole, sendNotification)
      onCancel()
    },
  })
)(isMobile ? HeaderHoc(ControlledRolePicker) : PopupWrapped)
