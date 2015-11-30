/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'

// $FlowIssue platform specific
import Header from './header.render'
// $FlowIssue platform specific
import Action from './action.render'
// $FlowIssue platform specific
import Bio from './bio.render'
// $FlowIssue platform specific
import Proofs from './proofs.render'

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

import commonStyles from '../styles/common'

export default class Render extends Component {
  props: RenderProps;

  render (): ReactElement {
    const headerProps = {...this.props.headerProps, style: styles.header}
    const bioProps = {...this.props.bioProps, style: styles.bio}
    const proofsProps = {...this.props.proofsProps, style: styles.proofs}
    const actionProps = {...this.props.actionProps, style: styles.action}

    return (
      <div style={{display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 800, backgroundColor: '#F2F2F2'}}>
        <div style={styles.container}>
          <Header {...headerProps} />
          <div style={styles.bodyContainer}>
            <Bio {...bioProps} />
            <Proofs {...proofsProps} />
          </div>
          <Action {...actionProps} />
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
