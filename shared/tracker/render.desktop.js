/* @flow */

import React, {Component} from 'react'

import Header from './header.render.desktop'
import Action from './action.render.desktop'
import Bio from './bio.render.desktop'
import Proofs from './proofs.render.desktop'
import commonStyles from '../styles/common'

import type {RenderProps} from './render'
import featureFlags from '../util/feature-flags'

export default class Render extends Component {
  props: RenderProps;

  render (): ReactElement {
    const headerProps = {...this.props.headerProps, style: styles.header}
    const bioProps = {...this.props.bioProps, style: styles.bio}
    const proofsProps = {...this.props.proofsProps, style: styles.proofs}
    const actionProps = {...this.props.actionProps, style: styles.action}

    return (
      <div style={styles.container}>
        <Header {...headerProps} />
        <div style={styles.bodyContainer}>
          <Bio {...bioProps} />
          <Proofs {...proofsProps} />
        </div>
        <Action {...actionProps} />
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
    ...commonStyles.fontRegular,
    backgroundColor: 'white',
    fontSize: 15,
    width: featureFlags.tracker === 'v2' ? 320 : 520,
    height: featureFlags.tracker === 'v2' ? 520 : 332
  },
  header: {
    height: 34
  },
  bodyContainer: {
    ...featureFlags.tracker === 'v2' ? commonStyles.flexBoxColumn : commonStyles.flexBoxRow,
    height: featureFlags.tracker === 'v2' ? 642 : 242
  },
  bio: {
    width: featureFlags.tracker === 'v2' ? 320 : 202
  },
  proofs: {
  },
  action: {
    height: 56
  }
}
