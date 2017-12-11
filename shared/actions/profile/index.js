// @flow
import * as AppGen from '../app-gen'
import * as Types from '../../constants/types/profile'
import * as Constants from '../../constants/profile'
import * as TrackerGen from '../tracker-gen'
import * as ProfileGen from '../profile-gen'
import * as Saga from '../../util/saga'
import * as SearchConstants from '../../constants/search'
import * as Selectors from '../../constants/selectors'
import * as RPCTypes from '../../constants/types/flow-types'
import URL from 'url-parse'
import keybaseUrl from '../../constants/urls'
import openURL from '../../util/open-url'
import {getPathProps} from '../../route-tree'
import {navigateAppend, navigateTo, navigateUp, switchTo, putActionIfOnPath} from '../../actions/route-tree'
import {parseUserId} from '../../util/platforms'
import {peopleTab} from '../../constants/tabs'
import {pgpSaga} from './pgp'
import {proofsSaga} from './proofs'

import type {TypedState} from '../../constants/reducer'

function* _editProfile(action: ProfileGen.EditProfilePayload): Saga.SagaGenerator<any, any> {
  const {bio, fullname, location} = action.payload
  yield Saga.call(RPCTypes.userProfileEditRpcPromise, {
    bio,
    fullName: fullname,
    location,
  })
  // If the profile tab remained on the edit profile screen, navigate back to the top level.
  yield Saga.put(putActionIfOnPath([peopleTab, 'editProfile'], navigateTo([], [peopleTab]), [peopleTab]))
}

function* _finishRevoking(): Saga.SagaGenerator<any, any> {
  yield Saga.put(TrackerGen.createGetMyProfile({ignoreCache: true}))
  yield Saga.put(ProfileGen.createRevokeFinish())
  yield Saga.put(navigateUp())
}

function* _showUserProfile(action: ProfileGen.ShowUserProfilePayload): Saga.SagaGenerator<any, any> {
  const {username: userId} = action.payload
  const searchResultMap = yield Saga.select(Selectors.searchResultMapSelector)
  const username = SearchConstants.maybeUpgradeSearchResultIdToKeybaseId(searchResultMap, userId)
  // get data on whose profile is currently being shown
  const me = yield Saga.select(Selectors.usernameSelector)
  const topProfile = yield Saga.select((state: TypedState) => {
    const routeState = state.routeTree.routeState
    const routeProps = getPathProps(routeState, [peopleTab])
    const profileNode = (routeProps && routeProps.size > 0 && routeProps.get(routeProps.size - 1)) || null
    return (
      (profileNode && profileNode.props && profileNode.props.get('username')) ||
      (profileNode && profileNode.node === peopleTab && me)
    )
  })

  // If the username is the top profile, just switch to the profile tab
  if (username === topProfile) {
    yield Saga.put(switchTo([peopleTab]))
    return
  }

  // Assume user exists
  if (!username.includes('@')) {
    yield Saga.put(switchTo([peopleTab]))
    yield Saga.put(navigateAppend([{props: {username}, selected: 'profile'}], [peopleTab]))
    return
  }

  // search for user first
  let props = {}
  const searchResult = yield Saga.select(Selectors.searchResultSelector, username)
  if (searchResult) {
    props = {
      fullname: searchResult.rightFullname,
      fullUsername: username,
      serviceName: searchResult.leftService,
      username: searchResult.leftUsername,
    }
  } else {
    const {username: parsedUsername, serviceId} = parseUserId(username)
    props = {
      fullUsername: username,
      serviceName: SearchConstants.serviceIdToService(serviceId),
      username: parsedUsername,
    }
  }

  yield Saga.put(switchTo([peopleTab]))
  yield Saga.put(navigateAppend([{props, selected: 'nonUserProfile'}], [peopleTab]))
}

function* _onClickAvatar(action: ProfileGen.OnClickFollowersPayload): Saga.SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    yield Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    yield Saga.call(openURL, `${keybaseUrl}/${action.payload.username}`)
  }
}

function* _onClickFollowers(action: ProfileGen.OnClickFollowersPayload): Saga.SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    yield Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    yield Saga.call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function* _onClickFollowing(action: ProfileGen.OnClickFollowingPayload): Saga.SagaGenerator<any, any> {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    yield Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    yield Saga.call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function* _submitRevokeProof(action: ProfileGen.SubmitRevokeProofPayload): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: true}))
    yield Saga.call(RPCTypes.revokeRevokeSigsRpcPromise, {sigIDQueries: [action.payload.proofId]})
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(ProfileGen.createFinishRevoking())
  } catch (error) {
    console.warn(`Error when revoking proof ${action.payload.proofId}`, error)
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(
      ProfileGen.createRevokeFinishError({
        error: 'There was an error revoking your proof. You can click the button to try again.',
      })
    )
  }
}

function _openURLIfNotNull(nullableThing, url, metaText): void {
  if (nullableThing == null) {
    console.warn("Can't openURL because we have a null", metaText)
    return
  }
  openURL(url)
}

function* _onAppLink(action: AppGen.LinkPayload): Saga.SagaGenerator<any, any> {
  const link = action.payload.link
  let url
  try {
    url = new URL(link)
  } catch (e) {
    console.log('AppLink: could not parse link', link)
    return
  }
  const username = Constants.urlToUsername(url)
  console.log('AppLink: url', url.href, 'username', username)
  if (username) {
    yield Saga.put(ProfileGen.createShowUserProfile({username}))
  }
}

function* _outputInstructionsActionLink(): Saga.SagaGenerator<any, any> {
  const getProfile = (state: TypedState) => state.profile
  const profile: Types.State = (yield Saga.select(getProfile): any)
  switch (profile.platform) {
    case 'twitter':
      yield Saga.call(
        _openURLIfNotNull,
        profile.proofText,
        `https://twitter.com/home?status=${profile.proofText || ''}`,
        'twitter url'
      )
      break
    case 'github':
      yield Saga.call(openURL, 'https://gist.github.com/')
      break
    case 'reddit':
      yield Saga.call(_openURLIfNotNull, profile.proofText, profile.proofText, 'reddit url')
      break
    case 'facebook':
      yield Saga.call(_openURLIfNotNull, profile.proofText, profile.proofText, 'facebook url')
      break
    case 'hackernews':
      yield Saga.call(openURL, `https://news.ycombinator.com/user?id=${profile.username}`)
      break
    default:
      break
  }
}

function* _backToProfile(): Saga.SagaGenerator<any, any> {
  yield Saga.put(TrackerGen.createGetMyProfile({}))
  yield Saga.put(navigateTo([], [peopleTab]))
}

function* _profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(ProfileGen.backToProfile, _backToProfile)
  yield Saga.safeTakeEvery(ProfileGen.editProfile, _editProfile)
  yield Saga.safeTakeEvery(ProfileGen.finishRevoking, _finishRevoking)
  yield Saga.safeTakeEvery(ProfileGen.onClickAvatar, _onClickAvatar)
  yield Saga.safeTakeEvery(ProfileGen.onClickFollowers, _onClickFollowers)
  yield Saga.safeTakeEvery(ProfileGen.onClickFollowing, _onClickFollowing)
  yield Saga.safeTakeEvery(ProfileGen.outputInstructionsActionLink, _outputInstructionsActionLink)
  yield Saga.safeTakeEvery(ProfileGen.showUserProfile, _showUserProfile)
  yield Saga.safeTakeEvery(ProfileGen.submitRevokeProof, _submitRevokeProof)
  yield Saga.safeTakeEvery(AppGen.link, _onAppLink)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.fork(_profileSaga)
  yield Saga.fork(pgpSaga)
  yield Saga.fork(proofsSaga)
}

export default profileSaga
