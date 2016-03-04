/* @flow */

import React, {Component} from 'react'

import Header from './header.render.desktop'
import Action, {calcFooterHeight} from './action.render.desktop'
import Bio from './bio.render.desktop'
import {ProofsRender, ProofsRender2} from './proofs.render.desktop'
import commonStyles from '../styles/common'
import flags from '../util/feature-flags'

import type {RenderProps} from './render'

export default class Render extends Component {
  props: RenderProps;

  render () {
    if (flags.tracker2) {
      return this.render2(styles2)
    }
    return this.renderDefault(styles1)
  }

  renderDefault (styles: Object) {
    return (
      <div style={styles.container}>
        <Header {...this.props.headerProps} />
        <div style={styles.bodyContainer}>
          <Bio {...this.props.bioProps} />
          <ProofsRender {...this.props.proofsProps} />
        </div>
        <Action {...this.props.actionProps} />
      </div>
    )
  }

  render2 (styles: Object) {
    // We have to calculate the height of the footer.
    // It's positioned absolute, so flex won't work here.
    // It's positioned absolute because we want the background transparency.
    // So we use the existing paddingBottom and add the height of the footer
    const footerHeight = calcFooterHeight(this.props.actionProps.loggedIn)
    const calculatedPadding = styles.content.paddingBottom + footerHeight
    return (
      <div style={styles.container}>
        <Header {...this.props.headerProps} />
        <div style={{...styles.content, paddingBottom: calculatedPadding}} className='hide-scrollbar'>
          <Bio {...this.props.bioProps} />
          <ProofsRender2 {...this.props.proofsProps} />
        </div>
        <div style={styles.footer}>
          <Action {...this.props.actionProps}/>
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
    // This value is added to the footer height to set the actual paddingBottom
    paddingBottom: 12,
    zIndex: 1
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  }
}
