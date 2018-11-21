// @flow
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as I from 'immutable'
import {namedConnect} from '../../../../../util/container'
import Chat from '.'
import {stat} from 'fs'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: {}) => ({
  ...state.notifications.chat.unfurl,
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
    onUnfurlSave: () =>

})
