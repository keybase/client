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

  renderDefault (styles: Object): ReactElement {
    return (
      <div style={styles.container}>
        <Header {...this.props.headerProps} />
        <div style={styles.bodyContainer}>
          <Bio {...this.props.bioProps} />
          <Proofs {...this.props.proofsProps} />
        </div>
        <Action {...this.props.actionProps} />
      </div>
    )
  }

  render2 (styles: Object): ReactElement {
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
  bodyContainer: {
    ...commonStyles.flexBoxRow,
    height: 242
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
