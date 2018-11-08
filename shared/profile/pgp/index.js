// @flow
import * as ProfileGen from '../../actions/profile-gen'
import Finished from './finished-generating-pgp'
import GeneratePgp from './generating-pgp'
import ImportPgp from './prove-pgp-import'
import PgpInfo from './add'
import ProvePgpChoice, {type Options as ProvePgpChoiceOptions} from './prove-pgp-choice'
import {navigateUp, navigateAppend} from '../../actions/route-tree'
import {connect} from '../../util/container'

type OwnProps = {||}

const ConnectedChoice = connect<OwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onCancel: () => dispatch(navigateUp()),
    onOptionClick: (type: ProvePgpChoiceOptions) => dispatch(navigateAppend([type])),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(ProvePgpChoice)

const ConnectedImport = connect<OwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onCancel: () => dispatch(navigateUp()),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(ImportPgp)

const ConnectedPgpInfo = connect<OwnProps, _, _, _, _>(
  ({profile: {pgpInfo}}) => ({
    ...pgpInfo,
  }),
  dispatch => ({
    onCancel: () => dispatch(navigateUp()),
    onChangeEmail1: email1 => dispatch(ProfileGen.createUpdatePgpInfo({info: {email1}})),
    onChangeEmail2: email2 => dispatch(ProfileGen.createUpdatePgpInfo({info: {email2}})),
    onChangeEmail3: email3 => dispatch(ProfileGen.createUpdatePgpInfo({info: {email3}})),
    onChangeFullName: fullName => dispatch(ProfileGen.createUpdatePgpInfo({info: {fullName}})),
    onNext: () => dispatch(ProfileGen.createGeneratePgp()),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(PgpInfo)

const ConnectedGeneratePgp = connect<OwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({
    onCancel: () => dispatch(ProfileGen.createCancelPgpGen()),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(GeneratePgp)

const ConnectedFinished = connect<OwnProps, _, _, _, _>(
  ({profile: {pgpPublicKey}}) => ({
    pgpKeyString: pgpPublicKey || 'Error getting public key...',
  }),
  dispatch => ({
    onDone: shouldStoreKeyOnServer => dispatch(ProfileGen.createFinishedWithKeyGen({shouldStoreKeyOnServer})),
  }),
  (s, d, o) => ({...o, ...s, ...d})
)(Finished)

export {ConnectedChoice, ConnectedImport, ConnectedPgpInfo, ConnectedGeneratePgp, ConnectedFinished}
