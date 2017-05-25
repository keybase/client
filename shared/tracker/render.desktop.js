// @flow
import React, {PureComponent} from 'react'
import Header from './header.render.desktop'
import Action, {calcFooterHeight} from './action.render.desktop'
import {UserProofs, UserBio} from '../common-adapters'
import {globalStyles} from '../styles'
import NonUser from './non-user'
import {autoResize} from '../desktop/renderer/remote-component-helper'
import TrackerError from './error'

import type {RenderProps} from './render'

export default class TrackerRender extends PureComponent<void, RenderProps, void> {
  componentDidMount() {
    autoResize()
  }

  render() {
    if (this.props.nonUser) {
      return (
        <NonUser
          onClose={this.props.onClose}
          name={this.props.name}
          serviceName={this.props.serviceName}
          reason={this.props.reason}
          inviteLink={this.props.inviteLink}
          isPrivate={this.props.isPrivate}
        />
      )
    }

    if (this.props.error != null) {
      return (
        <div style={styles.container}>
          <TrackerError
            errorMessage={this.props.error.errorMessage}
            onRetry={this.props.error.onRetry}
            onClose={this.props.onClose}
          />
        </div>
      )
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
          trackerState={this.props.trackerState}
          currentlyFollowing={this.props.currentlyFollowing}
          loggedIn={this.props.loggedIn}
        />
        <div
          style={{...styles.content, paddingBottom: calculatedPadding}}
          className="hide-scrollbar scroll-container"
        >
          <UserBio
            type="Tracker"
            style={{marginTop: 50}}
            avatarSize={80}
            loading={this.props.loading}
            username={this.props.username}
            userInfo={this.props.userInfo}
            currentlyFollowing={this.props.currentlyFollowing}
            trackerState={this.props.trackerState}
            onClickAvatar={this.props.onClickAvatar}
            onClickFollowers={this.props.onClickFollowers}
            onClickFollowing={this.props.onClickFollowing}
          />
          <UserProofs
            type="proofs"
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 8,
              position: 'relative',
              width: 325, // FIXME (mbg): fixed width to line up with existing layout which doesn't take scrollbar into account
            }}
            loadingStyle={{
              left: 24,
              right: 24,
            }}
            username={this.props.username}
            proofs={this.props.proofs}
            loading={this.props.loading}
            currentlyFollowing={this.props.currentlyFollowing}
          />
        </div>
        <div style={styles.footer}>
          {!this.props.loading &&
            this.props.actionBarReady &&
            <Action
              loggedIn={this.props.loggedIn}
              waiting={this.props.waiting}
              state={this.props.trackerState}
              currentlyFollowing={this.props.currentlyFollowing}
              username={this.props.username}
              lastAction={this.props.lastAction}
              onChat={this.props.onChat}
              onClose={this.props.onClose}
              onIgnore={this.props.onIgnore}
              onFollow={this.props.onFollow}
              onRefollow={this.props.onRefollow}
              onUnfollow={this.props.onUnfollow}
            />}
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
