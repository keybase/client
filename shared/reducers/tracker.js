// @flow
import * as TrackerGen from '../actions/tracker-gen'
import * as Types from '../constants/types/tracker'
import * as Constants from '../constants/tracker'

function updateUserState(
  state: Types.State,
  username: string,
  sub: (state: ?Types.TrackerState) => ?Types.TrackerState
): Types.State {
  return {
    ...state,
    userTrackers: {
      ...state.userTrackers,
      [username]: sub(state.userTrackers[username]),
    },
  }
}

function updateNonUserState(
  state: Types.State,
  username: string,
  sub: (state: ?Types.NonUserState) => ?Types.NonUserState
): Types.State {
  return {
    ...state,
    nonUserTrackers: {
      ...state.nonUserTrackers,
      [username]: sub(state.nonUserTrackers[username]),
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
        ...state,
        trackers: {},
        nonUserTrackers: {},
      }
    case TrackerGen.setStartTimer:
      return {
        ...state,
        timerActive: state.timerActive + 1,
      }
    case TrackerGen.stopTimer:
      return {
        ...state,
        timerActive: state.timerActive - 1,
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
      return updateNonUserState(state, action.payload.username, state => {
        return {
          ...state,
          closed: false,
          hidden: false,
          inviteLink: nonUser.throttled ? null : nonUser.inviteLink,
          isPrivate: nonUser.isPrivate,
          name: nonUser.assertion,
          reason: `You opened ${nonUser.folderName}`,
          serviceName: nonUser.socialAssertion.service,
        }
      })
    }
    case TrackerGen.setOnClose: {
      const {username} = action.payload
      const isUser = state.userTrackers[username]
      if (isUser) {
        return updateUserState(state, username, state => ({
          ...state,
          closed: true,
          hidden: false,
          lastAction: null,
          needTrackTokenDismiss: !!state && !state.trackToken, // did we have a track token at this time?
          shouldFollow: false, // don't follow if they close x out the window
        }))
      }
      const isNonUser = state.nonUserTrackers[username]
      if (isNonUser) {
        return updateNonUserState(state, username, state => ({
          ...state,
          closed: true,
          hidden: false,
        }))
      }
      break
    }
    case TrackerGen.updateUsername: {
      const {username} = action.payload
      return updateUserState(state, username, state => Constants.initialTrackerState(username))
    }
    case TrackerGen.identifyStarted:
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        error: null,
      }))
    case TrackerGen.updateReason:
      // In case the reason is null, let's use our existing reason
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        reason: (action.payload && action.payload.reason) || (state && state.reason),
      }))
    case TrackerGen.updateTrackToken: {
      const {trackToken} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        trackToken: trackToken,
      }))
    }
    case TrackerGen.setNeedTrackTokenDismiss: {
      const {needTrackTokenDismiss} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        needTrackTokenDismiss,
      }))
    }
    case TrackerGen.waiting: {
      const {waiting} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        waiting,
      }))
    }
    case TrackerGen.setOnFollow: {
      const {username} = action.payload
      return updateUserState(state, username, state => ({
        ...state,
        currentlyFollowing: true,
        lastAction: 'followed',
        reason: `You have followed ${username}.`,
      }))
    }
    case TrackerGen.setOnRefollow: {
      const {username} = action.payload
      return updateUserState(state, username, state => ({
        ...state,
        lastAction: 'refollowed',
        reason: `You have re-followed ${username}.`,
        trackerState: 'normal',
        eldestKidChanged: false,
      }))
    }
    case TrackerGen.setOnUnfollow: {
      const {username} = action.payload
      return updateUserState(state, username, state => ({
        ...state,
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
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        error,
      }))
    }
    case TrackerGen.updateEldestKidChanged: {
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        eldestKidChanged: true,
      }))
    }
    case TrackerGen.updateProofState: {
      const {username} = action.payload
      return updateUserState(state, username, state => {
        if (!state) {
          return state
        }
        const proofsGeneralState = Constants.overviewStateOfProofs(state.proofs)
        const trackerMessage = Constants.deriveTrackerMessage(
          username,
          state.currentlyFollowing,
          proofsGeneralState
        )
        const reason = trackerMessage || state.reason
        return {
          ...state,
          changed: proofsGeneralState.anyChanged,
          reason,
          shouldFollow: Constants.deriveShouldFollow(proofsGeneralState),
          trackerState: Constants.deriveSimpleProofState(state.eldestKidChanged, proofsGeneralState),
        }
      })
    }
    case TrackerGen.resetProofs:
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        proofs: [],
      }))
    case TrackerGen.setProofs: {
      const {identity, username} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        proofs: Constants.dedupeProofs([
          ...(state ? state.proofs : []),
          ...(identity.revokedDetails || []).map(rv => Constants.revokedProofToProof(rv)),
          ...(identity.proofs || [])
            .map(rp => Constants.remoteProofToProof(username, Constants.checking, rp.proof)),
        ]),
      }))
    }
    case TrackerGen.updatePGPKey: {
      const {pgpFingerprint, kid} = action.payload
      const fingerPrint = Constants.bufferToNiceHexString(pgpFingerprint)
      return updateUserState(state, action.payload.username, state => {
        const url = `https://keybase.io/${state ? state.username : ''}/sigchain`
        const proof = {
          color: 'green',
          // TODO: We don't currently get the sigID so we can't link to the actual sigChain statement. See https://keybase.atlassian.net/browse/CORE-3529
          humanUrl: url,
          id: kid,
          isTracked: state ? state.currentlyFollowing : false,
          mTime: 0,
          meta: null,
          name: fingerPrint,
          profileUrl: url,
          state: 'normal',
          type: 'pgp',
        }

        return {
          ...state,
          proofs: Constants.dedupeProofs(state ? state.proofs.concat([proof]) : [proof]),
        }
      })
    }
    case TrackerGen.updateZcash: {
      const {sigID, address} = action.payload
      return updateUserState(state, action.payload.username, state => {
        const url = `https://keybase.io/${state ? state.username : ''}/sigchain#${sigID}`
        const proof = {
          color: 'green',
          humanUrl: url,
          id: sigID,
          isTracked: state ? state.currentlyFollowing : false,
          mTime: 0,
          meta: null,
          name: address,
          profileUrl: url,
          state: 'normal',
          type: 'zcash',
        }

        return {
          ...state,
          proofs: Constants.dedupeProofs(state ? state.proofs.concat([proof]) : [proof]),
        }
      })
    }
    case TrackerGen.updateBTC: {
      const {sigID, address} = action.payload
      return updateUserState(state, action.payload.username, state => {
        const url = `https://keybase.io/${state ? state.username : ''}/sigchain#${sigID}`
        const proof = {
          color: 'green',
          humanUrl: url,
          id: sigID,
          isTracked: state ? state.currentlyFollowing : false,
          mTime: 0,
          meta: null,
          name: address,
          profileUrl: url,
          state: 'normal',
          type: 'btc',
        }

        return {
          ...state,
          proofs: Constants.dedupeProofs(state ? state.proofs.concat([proof]) : [proof]),
        }
      })
    }
    case TrackerGen.updateProof: {
      const {remoteProof, linkCheckResult, username} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        proofs: Constants.updateProof(username, state ? state.proofs : [], remoteProof, linkCheckResult),
      }))
    }
    case TrackerGen.updateUserInfo: {
      const {userCard, username} = action.payload
      const userInfo = {
        fullname: userCard.fullName,
        followersCount: userCard.followers,
        followingCount: userCard.following,
        followsYou: userCard.theyFollowYou,
        uid: userCard.uid,
        bio: userCard.bio,
        avatar: `https://keybase.io/${username}/picture`,
        location: userCard.location,
      }
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        userInfo,
      }))
    }
    case TrackerGen.markActiveIdentifyUi: {
      const {active} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        serverActive: active,
      }))
    }
    case TrackerGen.reportLastTrack: {
      const {tracking} = action.payload
      return updateUserState(state, action.payload.username, state => {
        const proofs = (state ? state.proofs : []).map(
          p => (['btc', 'pgp'].includes(p.type) ? {...p, isTracked: tracking} : p)
        )
        return {
          ...state,
          currentlyFollowing: tracking,
          proofs,
        }
      })
    }
    case TrackerGen.showTracker:
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        closed: false,
        hidden: false,
      }))
    case TrackerGen.remoteDismiss:
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        closed: true,
      }))
    case TrackerGen.setUpdateTrackers: {
      const {trackers, tracking} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        trackersLoaded: true,
        trackers,
        tracking,
      }))
    }
    case TrackerGen.updateFolders: {
      const {tlfs} = action.payload
      return updateUserState(state, action.payload.username, state => ({
        ...state,
        tlfs,
      }))
    }
    case TrackerGen.identifyFinished: {
      if (action.error) {
        const {error} = action.payload
        return updateUserState(state, action.payload.username, state => ({
          ...state,
          error,
          serverActive: false,
        }))
      } else {
        return updateUserState(state, action.payload.username, state => ({
          ...state,
          error: null,
        }))
      }
    }
  }
  return state
}
