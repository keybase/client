// @flow
import ProvePgpChoice from './prove-pgp-choice'
import ImportPgp from './prove-pgp-import'
import GeneratePgp from './generating-pgp'
import Finished from './finished-generating-pgp'
import PgpInfo from './add'
import {TypedConnector} from '../../util/typed-connect'
import {updatePgpInfo, generatePgp} from '../../actions/profile'
import {navigateUp, navigateAppend} from '../../actions/route-tree'
import * as Constants from '../../constants/profile'

import type {
  Props as ProvePgpChoiceProps,
  Options as ProvePgpChoiceOptions,
} from './prove-pgp-choice'
import type {Props as InfoProps} from './add'
import type {Props as GenerateProps} from './generating-pgp'
import type {Props as FinishedProps} from './finished-generating-pgp'
import type {Props as ImportProps} from './prove-pgp-import'
import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'

const choiceConnector: TypedConnector<
  TypedState,
  TypedDispatch<{}>,
  {},
  ProvePgpChoiceProps
> = new TypedConnector()
export const ConnectedChoice = choiceConnector.connect((state, dispatch, ownProps) => ({
  onCancel: () => {
    dispatch(navigateUp())
  },
  onOptionClick: (type: ProvePgpChoiceOptions) => {
    dispatch(navigateAppend([type]))
  },
}))(ProvePgpChoice)

const importConnector: TypedConnector<
  TypedState,
  TypedDispatch<{}>,
  {},
  ImportProps
> = new TypedConnector()
export const ConnectedImport = importConnector.connect((state, dispatch, ownProps) => ({
  onCancel: () => {
    dispatch(navigateUp())
  },
}))(ImportPgp)

const pgpInfoConnector: TypedConnector<
  TypedState,
  TypedDispatch<{}>,
  {},
  InfoProps
> = new TypedConnector()
export const ConnectedPgpInfo = pgpInfoConnector.connect((state, dispatch, ownProps) => {
  const {profile: {pgpInfo}} = state
  return {
    ...pgpInfo,
    onChangeFullName: next => {
      dispatch(updatePgpInfo({fullName: next}))
    },
    onChangeEmail1: next => {
      dispatch(updatePgpInfo({email1: next}))
    },
    onChangeEmail2: next => {
      dispatch(updatePgpInfo({email2: next}))
    },
    onChangeEmail3: next => {
      dispatch(updatePgpInfo({email3: next}))
    },
    onCancel: () => {
      dispatch(navigateUp())
    },
    onNext: () => {
      dispatch(generatePgp())
    },
  }
})(PgpInfo)

const generatePgpConnector: TypedConnector<
  TypedState,
  TypedDispatch<{}>,
  {},
  GenerateProps
> = new TypedConnector()
export const ConnectedGeneratePgp = generatePgpConnector.connect((state, dispatch, ownProps) => ({
  onCancel: () => {
    dispatch({type: Constants.cancelPgpGen, payload: {}})
  },
}))(GeneratePgp)

const finishedConnector: TypedConnector<
  TypedState,
  TypedDispatch<{}>,
  {},
  FinishedProps
> = new TypedConnector()
export const ConnectedFinished = finishedConnector.connect((state, dispatch, ownProps) => {
  const {profile: {pgpPublicKey}} = state
  return {
    pgpKeyString: pgpPublicKey || 'Error getting public key...',
    onDone: shouldStoreKeyOnServer => {
      dispatch({
        type: Constants.finishedWithKeyGen,
        payload: {shouldStoreKeyOnServer},
      })
    },
  }
})(Finished)
