// @flow
import * as Constants from '../../constants/profile'
import Finished from './finished-generating-pgp'
import GeneratePgp from './generating-pgp'
import ImportPgp from './prove-pgp-import'
import PgpInfo from './add'
import ProvePgpChoice, {type Options as ProvePgpChoiceOptions} from './prove-pgp-choice'
import {navigateUp, navigateAppend} from '../../actions/route-tree'
import {updatePgpInfo, generatePgp} from '../../actions/profile'
import {connect} from 'react-redux'

const ConnectedChoice = connect(
  () => ({}),
  (dispatch: Dispatch) => ({
    onCancel: () => dispatch(navigateUp()),
    onOptionClick: (type: ProvePgpChoiceOptions) => dispatch(navigateAppend([type])),
  })
)(ProvePgpChoice)

const ConnectedImport = connect(
  () => ({}),
  (dispatch: Dispatch) => ({
    onCancel: () => dispatch(navigateUp()),
  })
)(ImportPgp)

const ConnectedPgpInfo = connect(
  ({profile: {pgpInfo}}) => ({
    ...pgpInfo,
  }),
  (dispatch: Dispatch) => ({
    onCancel: () => dispatch(navigateUp()),
    onChangeEmail1: email1 => dispatch(updatePgpInfo({email1})),
    onChangeEmail2: email2 => dispatch(updatePgpInfo({email2})),
    onChangeEmail3: email3 => dispatch(updatePgpInfo({email3})),
    onChangeFullName: fullName => dispatch(updatePgpInfo({fullName})),
    onNext: () => dispatch(generatePgp()),
  })
)(PgpInfo)

const ConnectedGeneratePgp = connect(
  () => ({}),
  (dispatch: Dispatch) => ({
    onCancel: () => dispatch({payload: {}, type: Constants.cancelPgpGen}),
  })
)(GeneratePgp)

const ConnectedFinished = connect(
  ({profile: {pgpPublicKey}}) => ({
    pgpKeyString: pgpPublicKey || 'Error getting public key...',
  }),
  (dispatch: Dispatch) => ({
    onDone: shouldStoreKeyOnServer =>
      dispatch({payload: {shouldStoreKeyOnServer}, type: Constants.finishedWithKeyGen}),
  })
)(Finished)

export {ConnectedChoice, ConnectedImport, ConnectedPgpInfo, ConnectedGeneratePgp, ConnectedFinished}
