// @flow
import ProvePgpChoice from './prove-pgp-choice'
import ImportPgp from './prove-pgp-import'
import GeneratePgp from './generating-pgp'
import Finished from './finished-generating-pgp'
import PgpInfo from './add'
import React from 'react'
import {Map} from 'immutable'
import {TypedConnector} from '../../util/typed-connect'
import {updatePgpInfo, generatePgp} from '../../actions/profile'
import {navigateUp, navigateTo, routeAppend} from '../../actions/router'
import * as Constants from '../../constants/profile'

import type {Props as ProvePgpChoiceProps} from './prove-pgp-choice'
import type {Props as InfoProps} from './add'
import type {Props as GenerateProps} from './generating-pgp'
import type {Props as FinishedProps} from './finished-generating-pgp'
import type {Props as ImportProps} from './prove-pgp-import'
import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'
import type {URI} from '../../constants/router'

type PgpPhases = 'choice' | 'import' | 'generate' | 'provideInfo' | 'finished'
const handledRoutes: Array<PgpPhases> = ['choice', 'import', 'provideInfo', 'generate', 'finished']

function pathToPhase (currentPath: Map<string, string>, uri: URI): ?PgpPhases {
  const path = currentPath.get('path') || ''
  // A bit akward, but this is the type safe way. (read: flow is cool with it)
  const phase = handledRoutes.find(s => s === path)
  if (!phase) {
    console.warn(`Pgp Flow Container can not handle ${path}`)
    return null
  }
  return phase
}

function pathToComponent (path: PgpPhases) {
  switch (path) {
    case 'choice':
      return <ConnectedChoice />
    case 'import':
      return <ConnectedImport />
    case 'provideInfo':
      return <ConnectedPgpInfo />
    case 'generate':
      return <ConnectedGeneratePgp />
    case 'finished':
      return <ConnectedFinished />
  }
}

function pgpRouter (currentPath: Map<string, string>, uri: URI): any {
  const phase = pathToPhase(currentPath, uri)
  if (!phase) {
    throw new Error('Pgp Router failed', currentPath, uri)
  }

  return {
    componentAtTop: {
      element: pathToComponent(phase),
      hideBack: true,
      hideNavBar: true,
    },
    parseNextRoute: pgpRouter,
  }
}

const choiceConnector: TypedConnector<TypedState, TypedDispatch<{}>, {}, ProvePgpChoiceProps> = new TypedConnector()
const ConnectedChoice = choiceConnector.connect(
  (state, dispatch, ownProps) => ({
    onCancel: () => { dispatch(navigateTo([])) },
    onOptionClick: type => { dispatch(routeAppend(type)) },
  })
)(ProvePgpChoice)

const importConnector: TypedConnector<TypedState, TypedDispatch<{}>, {}, ImportProps> = new TypedConnector()
const ConnectedImport = importConnector.connect(
  (state, dispatch, ownProps) => ({
    onCancel: () => { dispatch(navigateUp()) },
  })
)(ImportPgp)

const pgpInfoConnector: TypedConnector<TypedState, TypedDispatch<{}>, {}, InfoProps> = new TypedConnector()
const ConnectedPgpInfo = pgpInfoConnector.connect(
  (state, dispatch, ownProps) => {
    const {profile: {pgpInfo}} = state
    return {
      ...pgpInfo,
      onChangeFullName: (next) => { dispatch(updatePgpInfo({fullName: next})) },
      onChangeEmail1: (next) => { dispatch(updatePgpInfo({email1: next})) },
      onChangeEmail2: (next) => { dispatch(updatePgpInfo({email2: next})) },
      onChangeEmail3: (next) => { dispatch(updatePgpInfo({email3: next})) },
      onCancel: () => { dispatch(navigateUp()) },
      onNext: () => { dispatch(generatePgp()) },
    }
  }
)(PgpInfo)

const generatePgpConnector: TypedConnector<TypedState, TypedDispatch<{}>, {}, GenerateProps> = new TypedConnector()
const ConnectedGeneratePgp = generatePgpConnector.connect(
  (state, dispatch, ownProps) => ({onCancel: () => { dispatch(navigateUp()) }})
)(GeneratePgp)

const finishedConnector: TypedConnector<TypedState, TypedDispatch<{}>, {}, FinishedProps> = new TypedConnector()
const ConnectedFinished = finishedConnector.connect(
  (state, dispatch, ownProps) => {
    const {profile: {pgpPublicKey}} = state
    return {
      pgpKeyString: pgpPublicKey || 'Error getting public key...',
      onDone: (shouldStoreKeyOnServer) => {
        dispatch({
          type: Constants.finishedWithKeyGen,
          payload: {shouldStoreKeyOnServer},
        })
      },
    }
  }
)(Finished)

export default pgpRouter
