// @flow
import * as React from 'react'
import * as I from 'immutable'
import {navigateAppend} from '../../actions/route-tree'
import {MakeOpenTeamConfirm, MakeTeamClosed, type OpenTeamConfirmProps} from '.'
import {connect} from 'react-redux'
import {compose, withState, withPropsOnChange} from 'recompose'
import * as Creators from '../../actions/teams/creators'
import * as Constants from '../../constants/teams'

type OpenTeamSettingProps = {
  navigateUp: Function,
  routeProps: I.RecordOf<{actualTeamName: string}>,
}

type _RoleState = {
  defaultRole: Constants.TeamRoleType,
  _onChangeDefaultRole: (role: Constants.TeamRoleType) => void,
}

const mapDispatchToProps = (dispatch, props: OpenTeamSettingProps & OpenTeamConfirmProps & _RoleState) => ({
  onClose: () => dispatch(props.navigateUp()),
  onMakeTeamOpen: () => {
    dispatch(Creators.makeTeamOpen(props.routeProps.get('actualTeamName'), true, props.defaultRole))
    dispatch(props.navigateUp())
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

const ConnectedMakeOpenTeamConfirm: React.ComponentType<OpenTeamSettingProps> = compose(
  withState('teamNameInput', 'onChangeTeamNameInput', ''),
  withState('defaultRole', '_onChangeDefaultRole', 'reader'),
  withPropsOnChange(['teamNameInput'], (props: OpenTeamConfirmProps & OpenTeamSettingProps) => ({
    confirmEnabled: props.teamNameInput === props.routeProps.get('actualTeamName'),
  })),
  connect(undefined, mapDispatchToProps)
)(MakeOpenTeamConfirm)

const ConnectedMakeTeamClosed: React.ComponentType<
  OpenTeamSettingProps
> = connect(undefined, (dispatch, props: OpenTeamSettingProps) => ({
  onMakeTeamClosed: () => {
    dispatch(Creators.makeTeamOpen(props.routeProps.get('actualTeamName'), false, 'reader'))
    dispatch(props.navigateUp())
  },
}))(MakeTeamClosed)

export {ConnectedMakeOpenTeamConfirm, ConnectedMakeTeamClosed}
