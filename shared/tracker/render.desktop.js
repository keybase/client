/* @flow */

import React, {Component} from 'react'

import Header from './header.render.desktop'
import Action, {calcFooterHeight} from './action.render.desktop'
import Bio from './bio.render.desktop'
import {ProofsRender} from './proofs.render.desktop'
import commonStyles from '../styles/common'

import type {RenderProps} from './render'

export default class Render extends Component {
  props: RenderProps;

  render () {
    // We have to calculate the height of the footer.
    // It's positioned absolute, so flex won't work here.
    // It's positioned absolute because we want the background transparency.
    // So we use the existing paddingBottom and add the height of the footer
    const footerHeight = calcFooterHeight(this.props.actionProps.loggedIn)
    const calculatedPadding = styles.content.paddingBottom + footerHeight
    return (
      <div style={styles.container}>
        <Header {...this.props.headerProps} />
        <div style={{...styles.content, paddingBottom: calculatedPadding}} className='tracker-scrollbar'>
          <Bio {...this.props.bioProps} />
          <ProofsRender {...this.props.proofsProps} />
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

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    width: 320,
    height: 470,
    position: 'relative'
  },
  content: {
    width: 320,
    overflow: 'overlay',
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
