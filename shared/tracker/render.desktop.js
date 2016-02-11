/* @flow */

import React, {Component} from 'react'

import Header from './header.render.desktop'
import Action from './action.render.desktop'
import Bio from './bio.render.desktop'
import Proofs from './proofs.render.desktop'
import commonStyles from '../styles/common'
import flags from '../util/feature-flags'

import type {RenderProps} from './render'

export default class Render extends Component {
  props: RenderProps;

  render (): ReactElement {
    if (flags.tracker2) {
      return this.render2(styles2)
    }
    return this.renderDefault(styles1)
  }

  renderDefault (styles: any): ReactElement {
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

  render2 (styles: any): ReactElement {
    return (
      <div style={styles.container}>
        <Header {...this.props.headerProps} />
        <div style={styles.content}>
          <Bio {...this.props.bioProps} />
          <Proofs {...this.props.proofsProps} />
        </div>
        <div style={styles.footer}>
          <Action {...this.props.actionProps} />
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

const styles1 = {
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

const footerHeight = 61

const styles2 = {
  container: {
    ...commonStyles.flexBoxColumn,
    width: 320,
    height: 470,
    position: 'relative'
  },
  content: {
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: 120
  },
  WebkitScrollbar: {
    display: 'none'
  },
  footer: {
    position: 'absolute',
    width: 320,
    height: footerHeight,
    bottom: 0
  }
}
