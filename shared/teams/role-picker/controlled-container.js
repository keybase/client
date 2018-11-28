// @flow
import React from 'react'
import {RoleOptions} from '.'
import {connect, compose, withHandlers, withStateHandlers, type RouteProps} from '../../util/container'
import {HeaderOrPopup, ScrollView} from '../../common-adapters/index'
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
  addButtonLabel?: string,
  allowOwner?: boolean,
  allowAdmin?: boolean,
  headerTitle?: string,
  pluralizeRoleName?: boolean,
  showNotificationCheckbox?: boolean,
  sendNotificationChecked?: boolean,
  styleCover?: Object,
  teamname: string,
}

type OwnProps = RouteProps<
  {
    ...ControlledRolePickerProps,
  },
  {}
>

const mapStateToProps = (state, {routeProps}) => {
  const currentType = routeProps.get('selectedRole')
  const _onComplete = routeProps.get('onComplete')
  const addButtonLabel = routeProps.get('addButtonLabel')
  const allowAdmin = routeProps.get('allowAdmin')
  const allowOwner = routeProps.get('allowOwner')
  const headerTitle = routeProps.get('headerTitle')
  const pluralizeRoleName = routeProps.get('pluralizeRoleName')
  const sendNotificationChecked = routeProps.get('sendNotificationChecked')
  const showSendNotification = routeProps.get('showNotificationCheckbox')
  const styleCover = routeProps.get('styleCover')
  return {
    _onComplete,
    addButtonLabel,
    allowAdmin,
    allowOwner,
    confirm: false,
    controlled: true,
    currentType,
    headerTitle,
    pluralizeRoleName,
    sendNotificationChecked,
    showSendNotification,
    styleCover,
    username: '',
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
})

// TODO fix typing
const ControlledRolePicker = (props: any) => (
  <ScrollView>
    <RoleOptions {...props} />
  </ScrollView>
)

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
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
)(HeaderOrPopup(ControlledRolePicker))
