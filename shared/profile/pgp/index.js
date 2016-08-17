// @flow
import ProvePgpChoice from './prove-pgp-choice'
import ImportPgp from './prove-pgp-import'
import GeneratePgp from './generating-pgp'
import React, {Component} from 'react'
import {Map} from 'immutable'
import {TypedConnector} from '../../util/typed-connect'
import {} from '../../actions/profile'
import {navigateUp, routeAppend} from '../../actions/router'

import type {Props as ProvePgpChoiceProps} from './prove-pgp-choice'
import type {Props as GenerateProps} from './generating-pgp'
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
  phase: 'generate',
  props: GenerateProps,
}

type PgpPhases = 'choice' | 'import' | 'generate'
// TODO (MM): It's possible to be more explicit here.
// For example we could say we only support import route
// iff it came from choice (choice -> import)
// It might look like [['choice', ['import', 'generate']]]
const handledRoutes: Array<PgpPhases> = ['choice', 'import', 'generate']

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
      case 'generate':
        return <GeneratePgp {...this.props.props} />
    }
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {phase: PgpPhases}, PgpFlowProps> = new TypedConnector()

const ConnectedPgpFlowContainer = connector.connect(
  (state, dispatch, ownProps) => {
    const {phase} = ownProps
    switch (phase) {
      case 'choice':
        return {
          phase: 'choice',
          props: {
            onCancel: () => { dispatch(navigateUp()) },
            onOptionClick: type => { dispatch(routeAppend(type)) },
          },
        }
      case 'import':
        return {
          phase: 'import',
          props: {onCancel: () => { dispatch(navigateUp()) }},
        }
      case 'generate':
        return {
          phase: 'generate',
          props: {onCancel: () => { dispatch(navigateUp()) }},
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
