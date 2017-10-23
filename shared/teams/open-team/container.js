// @flow
import React from 'react'
import * as I from 'immutable'
import {navigateAppend} from '../../actions/route-tree'
import {MakeOpenTeamConfirm, MakeTeamClosed, type OpenTeamConfirmProps} from '.'
import {connect} from 'react-redux'
import {compose, withState, withPropsOnChange} from 'recompose'
import * as Creators from '../../actions/teams/creators'
import * as Constants from '../../constants/teams'

type OpenTeamSettingProps = {
  onClose: () => void,
  routeProps: I.RecordOf<{actualTeamName: string}>,
}

type _RoleState = {
  defaultRole: Constants.TeamRoleType,
  _onChangeDefaultRole: (role: Constants.TeamRoleType) => void,
}

const mapDispatchToProps = (dispatch, props: OpenTeamSettingProps & OpenTeamConfirmProps & _RoleState) => ({
  onMakeTeamOpen: () => {
    dispatch(Creators.makeTeamOpen(props.routeProps.get('actualTeamName'), true, props.defaultRole))
    props.onClose()
  },
  onChangeDefaultRole: () => {
    dispatch(
      navigateAppend([
        {
          props: {
            onComplete: props._onChangeDefaultRole,
            selectedRole: props.defaultRole,
            allowOwner: false,
            allowAdmin: false,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

const ConnectedMakeOpenTeamConfirm: Class<React.Component<OpenTeamSettingProps, void>> = compose(
  withState('teamNameInput', 'onChangeTeamNameInput', ''),
  withState('defaultRole', '_onChangeDefaultRole', 'reader'),
  withPropsOnChange(['teamNameInput'], (props: OpenTeamConfirmProps & OpenTeamSettingProps) => ({
    confirmEnabled: props.teamNameInput === props.routeProps.get('actualTeamName'),
  })),
  connect(undefined, mapDispatchToProps)
)(MakeOpenTeamConfirm)

const ConnectedMakeTeamClosed: Class<
  React.Component<OpenTeamSettingProps, void>
> = connect(undefined, (dispatch, props: OpenTeamSettingProps) => ({
  onMakeTeamClosed: () => {
    dispatch(Creators.makeTeamOpen(props.routeProps.get('actualTeamName'), false, 'reader'))
    props.onClose()
  },
}))(MakeTeamClosed)

export {ConnectedMakeOpenTeamConfirm, ConnectedMakeTeamClosed}
