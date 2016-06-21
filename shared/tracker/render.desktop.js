/* @flow */

import React, {Component} from 'react'

import Header from './header.render.desktop'
import Action, {calcFooterHeight} from './action.render.desktop'
import {UserProofs, UserBio} from '../common-adapters'
import commonStyles from '../styles/common'
import NonUser from './non-user'
import {autoResize} from '../../desktop/renderer/remote-component-helper'

import type {RenderProps} from './render'

export default class Render extends Component<void, RenderProps, void> {
  props: RenderProps;

  componentDidMount () {
    autoResize()
  }

  render () {
    if (this.props.nonUser) {
      return <NonUser
        onClose={this.props.headerProps.onClose}
        name={this.props.name}
        serviceName={this.props.serviceName}
        reason={this.props.reason}
        inviteLink={this.props.inviteLink}
        isPrivate={this.props.isPrivate} />
    }

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
          <UserBio type='Tracker' {...this.props.bioProps} style={{marginTop: 50}} avatarSize={80} />
          <UserProofs {...this.props.proofsProps} style={{paddingTop: 8, paddingLeft: 30, paddingRight: 30}} />
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
  actionProps: React.PropTypes.any,
}

const styles = {
  container: {
    ...commonStyles.flexBoxColumn,
    width: 320,
    height: 470,
    position: 'relative',
  },
  content: {
    overflowY: 'auto',
    overflowX: 'hidden',
    // This value is added to the footer height to set the actual paddingBottom
    paddingBottom: 12,
    zIndex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
}
