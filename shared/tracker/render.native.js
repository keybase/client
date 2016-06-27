/* @flow */
import React, {Component} from 'react'
import {View} from 'react-native'

import Header from './header.render'
import {UserBio, UserProofs} from '../common-adapters'
import Action from './action.render'

import type {RenderProps} from './render'

export default class Render extends Component<void, RenderProps, void> {
  props: RenderProps;

  render () {
    return (
      <View style={stylesContainer}>
        <Header
          reason={this.props.reason}
          onClose={this.props.onClose}
          trackerState={this.props.trackerState}
          currentlyFollowing={this.props.currentlyFollowing}
          lastAction={this.props.lastAction}
          loggedIn={this.props.loggedIn}
        />
        <View style={stylesContent}>
          <UserBio type='Tracker'
            avatarSize={80}
            username={this.props.username}
            userInfo={this.props.userInfo}
            currentlyFollowing={this.props.currentlyFollowing}
            trackerState={this.props.trackerState}
          />
          <UserProofs
            username={this.props.username}
            proofs={this.props.proofs}
            currentlyFollowing={this.props.currentlyFollowing}
          />
        </View>
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
      </View>
    )
  }
}

const stylesContainer = {
  backgroundColor: 'red',
  flexDirection: 'column',
}
const stylesContent = {
  backgroundColor: 'green',
}
