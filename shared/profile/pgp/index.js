// @flow
import ProvePgpChoice from './prove-pgp-choice'
import ImportPgp from './prove-pgp-import'
import GeneratePgp from './generating-pgp'
import Finished from './finished-generating-pgp'
import PgpInfo from './add'
import React, {Component} from 'react'
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

type PgpFlowProps = {
  phase: 'choice',
  props: ProvePgpChoiceProps,
} | {
  phase: 'import',
  props: ImportProps,
} | {
  phase: 'provideInfo',
  props: InfoProps,
} | {
  phase: 'generate',
  props: GenerateProps,
} | {
  phase: 'finished',
  props: FinishedProps,
}

type PgpPhases = 'choice' | 'import' | 'generate' | 'provideInfo' | 'finished'
// TODO (MM): It's possible to be more explicit here.
// For example we could say we only support import route
// iff it came from choice (choice -> import)
// It might look like [['choice', ['import', ['provideInfo', 'generate']]]
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

function pgpRouter (currentPath: Map<string, string>, uri: URI): any {
  const phase = pathToPhase(currentPath, uri)
  if (!phase) {
    throw new Error('Pgp Router failed', currentPath, uri)
  }

  return {
    componentAtTop: {
      element: <ConnectedPgpFlowContainer phase={phase} />,
      hideBack: true,
      hideNavBar: true,
    },
    parseNextRoute: pgpRouter,
  }
}

// Handle the flow between the dumb components
class PgpFlowContainer extends Component<void, PgpFlowProps, void> {
  render () {
    switch (this.props.phase) {
      case 'choice':
        return <ProvePgpChoice {...this.props.props} />
      case 'import':
        return <ImportPgp {...this.props.props} />
      case 'provideInfo':
        return <PgpInfo {...this.props.props} />
      case 'generate':
        return <GeneratePgp {...this.props.props} />
      case 'finished':
        return <Finished {...this.props.props} />
    }
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {phase: PgpPhases}, PgpFlowProps> = new TypedConnector()

const ConnectedPgpFlowContainer = connector.connect(
  (state, dispatch, ownProps) => {
    const {phase} = ownProps
    const {profile: {pgpInfo}} = state
    switch (phase) {
      case 'choice':
        return {
          phase: 'choice',
          props: {
            onCancel: () => { dispatch(navigateTo([])) },
            onOptionClick: type => { dispatch(routeAppend(type)) },
          },
        }
      case 'import':
        return {
          phase: 'import',
          props: {onCancel: () => { dispatch(navigateUp()) }},
        }
      case 'provideInfo':
        return {
          phase: 'provideInfo',
          props: {
            ...pgpInfo,
            onChangeFullName: (next) => { dispatch(updatePgpInfo({fullName: next})) },
            onChangeEmail1: (next) => { dispatch(updatePgpInfo({email1: next})) },
            onChangeEmail2: (next) => { dispatch(updatePgpInfo({email2: next})) },
            onChangeEmail3: (next) => { dispatch(updatePgpInfo({email3: next})) },
            onCancel: () => { dispatch(navigateUp()) },
            onNext: () => { dispatch(generatePgp()) },
          },
        }
      case 'generate':
        return {
          phase: 'generate',
          props: {onCancel: () => { dispatch(navigateUp()) }},
        }
      case 'finished':
        const {profile: {pgpPublicKey}} = state
        return {
          phase: 'finished',
          props: {
            pgpKeyString: pgpPublicKey || 'Error getting public key...',
            onDone: (shouldStoreKeyOnServer) => {
              dispatch({
                type: Constants.finishedWithKeyGen,
                payload: {shouldStoreKeyOnServer},
              })
            },
          },
        }
    }

    // TODO (MM): turn this into an error view
    return {
      phase: 'choice',
      props: {
        onCancel: () => { dispatch(navigateUp()) },
        onOptionClick: type => { dispatch(routeAppend(type)) },
      },
    }
  }
)(PgpFlowContainer)

export default pgpRouter
