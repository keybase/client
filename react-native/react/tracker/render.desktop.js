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

// $FlowIssue styles
import commonStyles from '../styles/common'

export default class Render extends Component {
  props: RenderProps;

  render (): ReactElement {
    return (
      <div style={{display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 800, backgroundColor: '#F2F2F2'}}>
        <div style={styles.container}>
          <Header style={styles.header} {...this.props.headerProps} />
          <div style={styles.bodyContainer}>
            <Bio style={styles.bio} {...this.props.bioProps} />
            <Proofs style={styles.proofs} {...this.props.proofsProps} />
          </div>
          <Action style={styles.action} {...this.props.actionProps} />
        </div>
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
    backgroundColor: 'white',
    fontFamily: 'Noto Sans',
    fontSize: 15,
    height: 332,
    width: 520
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
