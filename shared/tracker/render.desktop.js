/* @flow */

import React, {Component} from 'react'

import Header from './header.render.desktop'
import Action, {calcFooterHeight} from './action.render.desktop'
import {UserProofs, UserBio} from '../common-adapters'
import {globalStyles} from '../styles/style-guide'
import NonUser from './non-user'
import {autoResize} from '../../desktop/renderer/remote-component-helper'

import type {RenderProps} from './render'

type State = {
  scrollBarWidth: number
}

export default class Render extends Component<void, RenderProps, State> {
  props: RenderProps;
  state: State;

  constructor () {
    super()
    this.state = {scrollBarWidth: 0}
  }

  componentDidMount () {
    autoResize()
  }

  render () {
    if (this.props.nonUser) {
      return <NonUser
        onClose={this.props.onClose}
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
    const footerHeight = calcFooterHeight(this.props.loggedIn)
    const calculatedPadding = styles.content.paddingBottom + footerHeight

    return (
      <div style={styles.container}>
        <Header
          reason={this.props.reason}
          onClose={this.props.onClose}
          scrollBarWidth={this.state.scrollBarWidth || 0}
          trackerState={this.props.trackerState}
          currentlyFollowing={this.props.currentlyFollowing}
          lastAction={this.props.lastAction}
          loggedIn={this.props.loggedIn}
        />
        <div style={{...styles.content, paddingBottom: calculatedPadding}} className='hide-scrollbar, scroll-container'>
          <div style={{flex: 1}} ref={r => {
            // Hack to detect if we have a scroll bar, and what it's width is
            // Note this has to be a div, otherwise we have to reach into Box's div
            if (!r || !r.clientWidth) {
              return
            }
            const containerSize = styles.container.width
            const actualSize = r.clientWidth
            const scrollBarWidth = containerSize - actualSize
            if (this.state.scrollBarWidth !== scrollBarWidth) {
              this.setState({scrollBarWidth})
            }
          }} />
          <UserBio type='Tracker'
            style={{marginTop: 50}}
            avatarSize={80}
            username={this.props.username}
            userInfo={this.props.userInfo}
            currentlyFollowing={this.props.currentlyFollowing}
            trackerState={this.props.trackerState}
          />
          <UserProofs
            style={{paddingTop: 8, paddingLeft: 30, paddingRight: 30}}
            username={this.props.username}
            proofs={this.props.proofs}
            currentlyFollowing={this.props.currentlyFollowing}
          />
        </div>
        <div style={styles.footer}>
          <Action
            loggedIn={this.props.loggedIn}
            waiting={this.props.waiting}
            state={this.props.trackerState}
            currentlyFollowing={this.props.currentlyFollowing}
            username={this.props.username}
            lastAction={this.props.lastAction}
            onClose={this.props.onClose}
            onIgnore={this.props.onIgnore}
            onFollow={this.props.onFollow}
            onRefollow={this.props.onRefollow}
            onUnfollow={this.props.onUnfollow}
          />
        </div>
      </div>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
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
