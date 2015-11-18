'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'

// $FlowIssue platform files
import Header from './header.render'
// $FlowIssue platform files
import Action from './action.render'
// $FlowIssue platform files
import Bio from './bio.render'
// $FlowIssue platform files
import Proofs from './proofs.render'

import type { BioProps } from './bio.render.desktop'
import type { ActionProps } from './action.render.desktop'
import type { HeaderProps } from './header.render.desktop'
import type { ProofsProps } from './proofs.render.desktop'

export type TrackerProps = {
  bioProps: BioProps,
  actionProps: ActionProps,
  headerProps: HeaderProps,
  proofsProps: ProofsProps
}

export default class Render extends Component {
  props: TrackerProps;

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

