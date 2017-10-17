// @flow
import React from 'react'
import * as I from 'immutable'
import {MakeOpenTeamConfirm, MakeTeamClosed, type OpenTeamConfirmProps} from '.'
import {connect} from 'react-redux'
import {compose, withState, withPropsOnChange} from 'recompose'
import * as Creators from '../../actions/teams/creators'

type OpenTeamSettingProps = {
  onClose: () => void,
  routeProps: I.RecordOf<{actualTeamName: string}>,
}

const mapDispatchToProps = (dispatch, props: OpenTeamSettingProps & OpenTeamConfirmProps) => ({
  onMakeTeamOpen: () => {
    dispatch(Creators.makeTeamOpen(props.routeProps.get('actualTeamName'), true, props.defaultRole))
    props.onClose()
  },
})

const ConnectedMakeOpenTeamConfirm: Class<React.Component<OpenTeamSettingProps, void>> = compose(
  withState('teamNameInput', 'onChangeTeamNameInput', ''),
  withState('defaultRole', 'onChangeDefaultRole', 'reader'),
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
