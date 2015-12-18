/* @flow */

import React, {Component} from '../base-react'

import Header from './header.render.desktop'
import Action from './action.render.desktop'
import Bio from './bio.render.desktop'
import Proofs from './proofs.render.desktop'

import type {RenderProps} from './render.types'

import commonStyles from '../styles/common'

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
