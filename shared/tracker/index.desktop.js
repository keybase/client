// @flow
import * as React from 'react'
import Header from './header.desktop'
import Action, {calcFooterHeight} from './action.desktop'
import {Avatar, Box, Meta, Text} from '../common-adapters'
import UserProofs from '../profile/user-proofs'
import UserBio from '../profile/user-bio'
import {globalColors, globalMargins, globalStyles} from '../styles'
import {ModalPositionRelative} from '../common-adapters/relative-popup-hoc.desktop'
import TeamInfo from '../profile/showcased-team-info'
import NonUser from './non-user'
import {autoResize} from '../desktop/remote/util.desktop'
import TrackerError from './error.desktop'

import type {Props} from '.'

export default class TrackerRender extends React.PureComponent<Props> {
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

    if (this.props.errorMessage != null) {
      return (
        <div style={styleContainer}>
          <TrackerError
            errorMessage={this.props.errorMessage}
            onRetry={this.props.onRetry}
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
    const calculatedPadding = styleContent.paddingBottom + footerHeight
    const ModalPopupComponent = ModalPositionRelative(TeamInfo)
    return (
      <div style={styleContainer}>
        <Header
          reason={this.props.reason}
          onClose={this.props.onClose}
          trackerState={this.props.trackerState}
          currentlyFollowing={this.props.currentlyFollowing}
          loggedIn={this.props.loggedIn}
        />
        <div
          style={{...styleContent, paddingBottom: calculatedPadding}}
          className="hide-scrollbar scroll-container"
        >
          <UserBio
            type="Tracker"
            style={{marginTop: 50}}
            avatarSize={96}
            loading={this.props.loading}
            username={this.props.username}
            userInfo={this.props.userInfo}
            currentlyFollowing={this.props.currentlyFollowing}
            trackerState={this.props.trackerState}
            onClickAvatar={this.props.onClickAvatar}
          />
          {!!this.props.userInfo &&
            !!this.props.userInfo.showcasedTeams &&
            this.props.userInfo.showcasedTeams.length > 0 && (
              <Box
                style={{
                  ...globalStyles.flexBoxColumn,
                  backgroundColor: globalColors.white,
                  paddingBottom: globalMargins.tiny,
                  paddingLeft: globalMargins.medium,
                  paddingTop: globalMargins.tiny,
                }}
              >
                {this.props.userInfo.showcasedTeams.map(team => (
                  <Box
                    key={team.fqName}
                    onClick={event => {
                      const node = event.target instanceof window.HTMLElement ? event.target : null
                      const targetRect = node && node.getBoundingClientRect()
                      if (!this.props.showTeam || team.fqName !== this.props.showTeam.fqName) {
                        this.props.onUpdateSelectedTeam(team.fqName)
                        this.props.onSetSelectedTeamRect(targetRect)
                        this.props._onSetTeamJoinError('')
                        this.props._onSetTeamJoinSuccess(false)
                        this.props._loadTeams()
                        this.props._checkRequestedAccess(team.fqName)
                      }
                    }}
                    style={{
                      ...globalStyles.flexBoxRow,
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      justifyContent: 'flex-start',
                      marginBottom: globalMargins.xtiny,
                      minHeight: 24,
                    }}
                  >
                    {this.props.showTeam &&
                      this.props.showTeam.fqName === team.fqName &&
                      this.props.selectedTeamRect && (
                        <Box key={team.fqName + 'popup'} style={{zIndex: 50}}>
                          {/* $FlowIssue style will always be overridden */}
                          <ModalPopupComponent
                            {...this.props}
                            targetRect={this.props.selectedTeamRect}
                            position="top left"
                            style={{zIndex: 50}}
                            popupNode={<Box />}
                            onClosePopup={() => {
                              this.props.onUpdateSelectedTeam('')
                              this.props.onSetSelectedTeamRect(null)
                            }}
                          />
                        </Box>
                      )}
                    <Box
                      style={{
                        ...globalStyles.flexBoxRow,
                        alignItems: 'center',
                        alignSelf: 'center',
                        height: 32,
                        minHeight: 32,
                        minWidth: 32,
                        width: 32,
                      }}
                    >
                      <Avatar teamname={team.fqName} size={32} />
                    </Box>
                    <Box
                      style={{
                        ...globalStyles.flexBoxRow,
                        alignItems: 'center',
                        alignSelf: 'center',
                        justifyContent: 'center',
                        paddingLeft: globalMargins.tiny,
                      }}
                    >
                      <Text type="BodySemibold">{team.fqName}</Text>
                      {team.open && (
                        <Meta title="open" style={styleMeta} backgroundColor={globalColors.green} />
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

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
        <div style={styleFooter}>
          {!this.props.loading && this.props.actionBarReady && (
            <Action
              loggedIn={this.props.loggedIn}
              waiting={this.props.waiting}
              state={this.props.trackerState}
              currentlyFollowing={this.props.currentlyFollowing}
              username={this.props.username}
              myUsername={this.props.myUsername}
              lastAction={this.props.lastAction}
              onChat={this.props.onChat}
              onClose={this.props.onClose}
              onIgnore={this.props.onIgnore}
              onFollow={this.props.onFollow}
              onRefollow={this.props.onRefollow}
              onUnfollow={this.props.onUnfollow}
            />
          )}
        </div>
      </div>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  height: 470,
  position: 'relative',
  width: 320,
}

const styleContent = {
  overflowX: 'hidden',
  overflowY: 'auto',
  // This value is added to the footer height to set the actual paddingBottom
  paddingBottom: 12,
  zIndex: 1,
}

const styleFooter = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
}

const styleMeta = {
  alignSelf: 'center',
  marginLeft: globalMargins.xtiny,
  marginTop: 2,
}
