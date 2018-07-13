// @flow
import * as LoginGen from '../../../actions/login-gen'
import * as React from 'react'
import CodePage2 from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

type OwnProps = {}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(CodePage2)
