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

import commonStyles from '../styles/common'

import type {BioProps} from './bio.render.desktop'
import type {ActionProps} from './action.render.desktop'
import type {HeaderProps} from './header.render.desktop'
import type {ProofsProps} from './proofs.render.desktop'

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
      <div style={styles.container}>
        <Header style={styles.header} {...this.props.headerProps} />
        <div style={styles.bodyContainer}>
          <Bio style={styles.bio} {...this.props.bioProps} />
          <Proofs style={styles.proofs} {...this.props.proofsProps} />
        </div>
        <Action style={styles.action} {...this.props.actionProps} />
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

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    width: 520,
    height: 332,
    fontFamily: 'Noto Sans'
  },
  header: {
    height: 34
  },
  bodyContainer: {
    ...commonStyles.flexBoxRow,
    height: 242
  },
  bio: {
    width: 202
  },
  proofs: {
  },
  action: {
    height: 56
  }
}
