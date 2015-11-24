/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'

import Header from './header.render'
import Action from './action.render'
import Bio from './bio.render'
import Proofs from './proofs.render'

// $FlowIssue platform files
import type {BioProps} from './bio.render'
// $FlowIssue platform files
import type {ActionProps} from './action.render'
// $FlowIssue platform files
import type {HeaderProps} from './header.render'
// $FlowIssue platform files
import type {ProofsProps} from './proofs.render'

export type RenderProps = {
  bioProps: BioProps,
  actionProps: ActionProps,
  headerProps: HeaderProps,
  proofsProps: ProofsProps
}

export default class Render extends Component {
  props: RenderProps;

  render (): ReactElement {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <Header {...this.props.headerProps} />
        <div style={{display: 'flex', flex: 1, flexDirection: 'row', height: 480}}>
          <Bio {...this.props.bioProps} />
          <Proofs {...this.props.proofsProps} />
        </div>
        <Action {...this.props.actionProps} />
      </div>
    )
  }
}

Render.propTypes = {
  headerProps: React.PropTypes.any,
  bioProps: React.PropTypes.any,
  proofsProps: React.PropTypes.any,
  actionProps: React.PropTypes.any
}
