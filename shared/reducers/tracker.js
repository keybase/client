// @flow
import * as TrackerGen from '../actions/tracker-gen'
import * as Types from '../constants/types/tracker'
import * as Constants from '../constants/tracker'
import * as Flow from '../util/flow'

const sortByTeamName = (a, b) => a.fqName.localeCompare(b.fqName)

function updateUserState(
  state: Types.State,
  username: string,
  sub: (state: ?Types.TrackerState) => ?Types.TrackerState
): Types.State {
  if (!username) {
    return state
  }
  const subState = sub(state.userTrackers[username])
  return {
    ...state,
    userTrackers: {
      ...state.userTrackers,
      [username]: subState,
    },
  }
}

function updateNonUserState(
  state: Types.State,
  username: string,
  sub: (state: ?Types.NonUserState) => ?Types.NonUserState
): Types.State {
  if (!username) {
    return state
  }
  const subState = sub(state.nonUserTrackers[username])
  return {
    ...state,
    nonUserTrackers: {
      ...state.nonUserTrackers,
      [username]: subState,
    },
  }
}

export default function(
  state: Types.State = Constants.initialState,
  action: TrackerGen.Actions
): Types.State {
  switch (action.type) {
    case TrackerGen.resetStore:
      return {
        ...Constants.initialState,
        serverStarted: state.serverStarted,
      }
    case TrackerGen.cacheIdentify: {
      const {goodTill, uid} = action.payload
      return {
        ...state,
        cachedIdentifies: {
          ...state.cachedIdentifies,
          [uid]: goodTill,
        },
      }
    }
    case TrackerGen.pendingIdentify: {
      const {username, pending} = action.payload
      return {
        ...state,
        pendingIdentifies: {
          ...state.pendingIdentifies,
          [username]: pending ? true : undefined,
        },
      }
    }
    case TrackerGen.setRegisterIdentifyUi: {
      const {started} = action.payload
      return {
        ...state,
        serverStarted: started,
      }
    }

    case TrackerGen.showNonUser: {
      const {nonUser} = action.payload
      return updateNonUserState(state, action.payload.username, s => {
        return {
          ...s,
          closed: false,
          hidden: false,
          inviteLink: nonUser.throttled ? null : nonUser.inviteLink,
          isPrivate: nonUser.isPrivate,
          name: nonUser.assertion,
          reason: `You opened ${nonUser.folderName}`,
          serviceName: nonUser.service,
          type: 'nonUser',
        }
      })
    }
    case TrackerGen.onClose: {
      const {username} = action.payload
      const isUser = state.userTrackers[username]
      if (isUser) {
        return updateUserState(state, username, s => ({
          ...s,
          closed: true,
          hidden: false,
          lastAction: null,
          needTrackTokenDismiss: !!s && !s.trackToken, // did we have a track token at this time?
          shouldFollow: false, // don't follow if they close x out the window
        }))
      }
      const isNonUser = state.nonUserTrackers[username]
      if (isNonUser) {
        return updateNonUserState(state, username, s => ({
          ...s,
          closed: true,
          hidden: false,
        }))
      }
      return state
    }
    case TrackerGen.updateUsername: {
      const {username} = action.payload
      return updateUserState(state, username, s => s || Constants.initialTrackerState(username))
    }
    case TrackerGen.identifyStarted:
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        error: null,
      }))
    case TrackerGen.updateSelectedTeam: {
      const {selectedTeam, username} = action.payload
      return updateUserState(state, username, s => ({
        ...s,
        selectedTeam,
      }))
    }
    case TrackerGen.updateReason:
      // In case the reason is null, let's use our existing reason
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        reason: (action.payload && action.payload.reason) || (s && s.reason),
      }))
    case TrackerGen.updateTrackToken: {
      const {trackToken} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        trackToken: trackToken,
      }))
    }
    case TrackerGen.setNeedTrackTokenDismiss: {
      const {needTrackTokenDismiss} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        needTrackTokenDismiss,
      }))
    }
    case TrackerGen.waiting: {
      const {waiting} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        waiting,
      }))
    }
    case TrackerGen.setOnFollow: {
      const {username} = action.payload
      return updateUserState(state, username, s => ({
        ...s,
        currentlyFollowing: true,
        lastAction: 'followed',
        reason: `You have followed ${username}.`,
      }))
    }
    case TrackerGen.setOnRefollow: {
      const {username} = action.payload
      return updateUserState(state, username, s => ({
        ...s,
        eldestKidChanged: false,
        lastAction: 'refollowed',
        reason: `You have re-followed ${username}.`,
        trackerState: 'normal',
      }))
    }
    case TrackerGen.setOnUnfollow: {
      const {username} = action.payload
      return updateUserState(state, username, s => ({
        ...s,
        currentlyFollowing: false,
        lastAction: 'unfollowed',
        reason: `You have unfollowed ${username}.`,
      }))
    }
    case TrackerGen.onError: {
      let error = 'There was an error updating your follow status.'
      if (action.payload && action.payload.extraText) {
        error = `There was an error: ${action.payload.extraText}`
      }
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        error,
      }))
    }
    case TrackerGen.updateEldestKidChanged: {
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        eldestKidChanged: true,
      }))
    }
    case TrackerGen.updateProofState: {
      const {username} = action.payload
      return updateUserState(state, username, s => {
        if (!s) {
          return s
        }
        const proofsGeneralState = Constants.overviewStateOfProofs(s.proofs)
        const trackerMessage = Constants.deriveTrackerMessage(
          username,
          s.currentlyFollowing,
          proofsGeneralState
        )
        const reason = trackerMessage || s.reason
        return {
          ...s,
          changed: proofsGeneralState.anyChanged,
          reason,
          shouldFollow: Constants.deriveShouldFollow(proofsGeneralState),
          trackerState: Constants.deriveSimpleProofState(s.eldestKidChanged, proofsGeneralState),
        }
      })
    }
    case TrackerGen.resetProofs:
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        proofs: [],
      }))
    case TrackerGen.setProofs: {
      const {identity, username} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        proofs: Constants.dedupeProofs([
          ...(s ? s.proofs : []),
          ...(identity.revokedDetails || []).map(rv => Constants.revokedProofToProof(rv)),
          ...(identity.proofs || []).map(rp =>
            Constants.remoteProofToProof(username, Constants.checking, rp.proof)
          ),
        ]),
      }))
    }
    case TrackerGen.updatePGPKey: {
      const {pgpFingerprint, kid} = action.payload
      const fingerPrint = Constants.bufferToNiceHexString(pgpFingerprint)
      return updateUserState(state, action.payload.username, s => {
        const url = `https://keybase.io/${s ? s.username : ''}/sigchain`
        const proof = {
          color: 'green',
          // TODO: We don't currently get the sigID so we can't link to the actual sigChain statement. See https://keybase.atlassian.net/browse/CORE-3529
          humanUrl: url,
          id: kid,
          isTracked: s ? s.currentlyFollowing : false,
          mTime: 0,
          meta: null,
          name: fingerPrint,
          profileUrl: url,
          state: 'normal',
          type: 'pgp',
        }

        return {
          ...s,
          proofs: Constants.dedupeProofs(s ? s.proofs.concat([proof]) : [proof]),
        }
      })
    }
    case TrackerGen.updateZcash: {
      const {sigID, address} = action.payload
      return updateUserState(state, action.payload.username, s => {
        const url = `https://keybase.io/${s ? s.username : ''}/sigchain#${sigID}`
        const proof = {
          color: 'green',
          humanUrl: url,
          id: sigID,
          isTracked: s ? s.currentlyFollowing : false,
          mTime: 0,
          meta: null,
          name: address,
          profileUrl: url,
          state: 'normal',
          type: 'zcash',
        }

        return {
          ...s,
          proofs: Constants.dedupeProofs(s ? s.proofs.concat([proof]) : [proof]),
        }
      })
    }
    case TrackerGen.updateBTC: {
      const {sigID, address} = action.payload
      return updateUserState(state, action.payload.username, s => {
        const url = `https://keybase.io/${s ? s.username : ''}/sigchain#${sigID}`
        const proof = {
          color: 'green',
          humanUrl: url,
          id: sigID,
          isTracked: s ? s.currentlyFollowing : false,
          mTime: 0,
          meta: null,
          name: address,
          profileUrl: url,
          state: 'normal',
          type: 'btc',
        }

        return {
          ...s,
          proofs: Constants.dedupeProofs(s ? s.proofs.concat([proof]) : [proof]),
        }
      })
    }
    case TrackerGen.updateProof: {
      const {remoteProof, linkCheckResult, username} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        proofs: Constants.updateProof(username, s ? s.proofs : [], remoteProof, linkCheckResult),
      }))
    }
    case TrackerGen.updateUserInfo: {
      const {userCard, username} = action.payload
      const userInfo = {
        avatar: `https://keybase.io/${username}/picture`,
        bio: userCard.bio,
        followersCount: userCard.followers,
        followingCount: userCard.following,
        followsYou: userCard.theyFollowYou,
        fullname: userCard.fullName,
        location: userCard.location,
        showcasedTeams: (userCard.teamShowcase || []).sort(sortByTeamName),
        uid: userCard.uid,
      }
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        userInfo,
      }))
    }
    case TrackerGen.markActiveIdentifyUi: {
      const {active} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        serverActive: active,
      }))
    }
    case TrackerGen.reportLastTrack: {
      const {tracking} = action.payload
      return updateUserState(state, action.payload.username, s => {
        const proofs = (s ? s.proofs : []).map(p =>
          ['btc', 'pgp'].includes(p.type) ? {...p, isTracked: tracking} : p
        )
        return {
          ...s,
          currentlyFollowing: tracking,
          proofs,
        }
      })
    }
    case TrackerGen.showTracker:
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        closed: false,
        hidden: false,
      }))
    case TrackerGen.remoteDismiss:
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        closed: true,
      }))
    case TrackerGen.setUpdateTrackers: {
      const {trackers, tracking} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        trackers,
        trackersLoaded: true,
        tracking,
      }))
    }
    case TrackerGen.updateFolders: {
      const {tlfs} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        tlfs,
      }))
    }
    case TrackerGen.identifyFinished: {
      if (action.error) {
        const {error} = action.payload
        return updateUserState(state, action.payload.username, s => ({
          ...s,
          error,
          serverActive: false,
        }))
      } else {
        return updateUserState(state, action.payload.username, s => ({
          ...s,
          error: null,
        }))
      }
    }
    case TrackerGen.updateStellarAddress: {
      const {federationAddress} = action.payload
      return updateUserState(state, action.payload.username, s => ({
        ...s,
        stellarFederationAddress: federationAddress,
      }))
    }
    // Saga only actions
    case TrackerGen.follow:
    case TrackerGen.getMyProfile:
    case TrackerGen.getProfile:
    case TrackerGen.ignore:
    case TrackerGen.openProofUrl:
    case TrackerGen.parseFriendship:
    case TrackerGen.refollow:
    case TrackerGen.unfollow:
    case TrackerGen.updateTrackers:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
