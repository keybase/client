/* @flow */

import React, {Component} from 'react'

import Header from './header.render.desktop'
import Action, {calcFooterHeight} from './action.render.desktop'
import Bio from './bio.render.desktop'
import {ProofsRender} from './proofs.render.desktop'
import commonStyles from '../styles/common'
import {globalColors} from '../styles/style-guide'

import type {RenderProps} from './render'

export default class Render extends Component {
  props: RenderProps;
  state: {showCloseWarning: boolean};

  constructor (props: RenderProps) {
    super(props)

    this.state = {showCloseWarning: false}
  }

  onShowCloseWarning (showCloseWarning: boolean): void {
    this.setState({showCloseWarning})
  }

  render () {
    // We have to calculate the height of the footer.
    // It's positioned absolute, so flex won't work here.
    // It's positioned absolute because we want the background transparency.
    // So we use the existing paddingBottom and add the height of the footer
    const footerHeight = calcFooterHeight(this.props.actionProps.loggedIn)
    const calculatedPadding = styles.content.paddingBottom + footerHeight

    let backgroundStyle = (this.props.headerProps.currentlyFollowing && !this.props.headerProps.changed) ? styles.headerSuccess : styles.headerNormal

    if (this.props.headerProps.currentlyFollowing) {
      switch (this.props.headerProps.trackerState) {
        case 'warning': backgroundStyle = styles.headerWarning; break
        case 'error': backgroundStyle = styles.headerError; break
      }
    }

    if (this.props.actionProps.loggedIn && !this.props.headerProps.currentlyFollowing && this.state.showCloseWarning) {
      backgroundStyle = styles.headerWarning
    }

    // If there's a lastAction, it overrides everything else.
    switch (this.props.headerProps.lastAction) {
      case 'followed':
      case 'refollowed':
      case 'unfollowed':
        backgroundStyle = styles.headerSuccess
        break
      case 'error':
        backgroundStyle = styles.headerWarning
    }

    return (
      <div style={styles.container}>
        <Header {...this.props.headerProps}
          backgroundStyle={backgroundStyle}
          headerWarning={styles.headerWarning}
          showCloseWarning={this.state.showCloseWarning}
          onShowCloseWarning={show => this.onShowCloseWarning(show)}/>
        <div style={{...styles.content, paddingBottom: calculatedPadding}}>
          <Bio {...this.props.bioProps} backgroundStyle={backgroundStyle} />
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
    overflowY: 'scroll',
    overflowX: 'hidden',
    // This value is added to the footer height to set the actual paddingBottom
    paddingBottom: 12
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  headerNormal: {
    backgroundColor: globalColors.blue
  },
  headerSuccess: {
    backgroundColor: globalColors.green
  },
  headerWarning: {
    backgroundColor: globalColors.yellow
  },
  headerError: {
    backgroundColor: globalColors.red
  }
}
