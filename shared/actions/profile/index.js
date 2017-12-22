// @flow
import logger from '../../logger'
import * as AppGen from '../app-gen'
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

function _editProfile(action: ProfileGen.EditProfilePayload) {
  const {bio, fullname, location} = action.payload
  return Saga.sequentially([
    Saga.call(RPCTypes.userProfileEditRpcPromise, {
      bio,
      fullName: fullname,
      location,
    }),
    // If the profile tab remained on the edit profile screen, navigate back to the top level.
    Saga.put(putActionIfOnPath([peopleTab, 'editProfile'], navigateTo([], [peopleTab]), [peopleTab])),
  ])
}

function _finishRevoking() {
  return Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({ignoreCache: true})),
    Saga.put(ProfileGen.createRevokeFinish()),
    Saga.put(navigateUp()),
  ])
}

function _showUserProfile(action: ProfileGen.ShowUserProfilePayload, state: TypedState) {
  const {username: userId} = action.payload
  const searchResultMap = Selectors.searchResultMapSelector(state)
  const username = SearchConstants.maybeUpgradeSearchResultIdToKeybaseId(searchResultMap, userId)
  // get data on whose profile is currently being shown
  const getTopProfile = (state: TypedState) => {
    const routeState = state.routeTree.routeState
    const routeProps = getPathProps(routeState, [peopleTab])
    const profileNode = (routeProps && routeProps.size > 0 && routeProps.get(routeProps.size - 1)) || null
    return profileNode && profileNode.props && profileNode.props.get('username')
  }

  const topProfile = getTopProfile(state)

  // If the username is the top profile, just switch to the profile tab
  if (username === topProfile) {
    return Saga.put(switchTo([peopleTab]))
  }

  // Assume user exists
  if (!username.includes('@')) {
    return Saga.sequentially([
      Saga.put(switchTo([peopleTab])),
      Saga.put(navigateAppend([{props: {username}, selected: 'profile'}], [peopleTab])),
    ])
  }

  // search for user first
  let props = {}
  const searchResult = Selectors.searchResultSelector(state, username)
  if (searchResult) {
    props = {
      fullname: searchResult.leftFullname,
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

  return Saga.sequentially([
    Saga.put(switchTo([peopleTab])),
    Saga.put(navigateAppend([{props, selected: 'nonUserProfile'}], [peopleTab])),
  ])
}

function _onClickAvatar(action: ProfileGen.OnClickFollowersPayload) {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    return Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    return Saga.call(openURL, `${keybaseUrl}/${action.payload.username}`)
  }
}

function _openProfileOrWebsite(
  action: ProfileGen.OnClickFollowersPayload | ProfileGen.OnClickFollowingPayload
) {
  if (!action.payload.username) {
    return
  }

  if (!action.openWebsite) {
    return Saga.put(ProfileGen.createShowUserProfile({username: action.payload.username}))
  } else {
    return Saga.call(openURL, `${keybaseUrl}/${action.payload.username}#profile-tracking-section`)
  }
}

function* _submitRevokeProof(action: ProfileGen.SubmitRevokeProofPayload): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: true}))
    yield Saga.call(RPCTypes.revokeRevokeSigsRpcPromise, {sigIDQueries: [action.payload.proofId]})
    yield Saga.put(ProfileGen.createRevokeWaiting({waiting: false}))
    yield Saga.put(ProfileGen.createFinishRevoking())
  } catch (error) {
    logger.warn(`Error when revoking proof ${action.payload.proofId}`, error)
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
    logger.warn("Can't openURL because we have a null", metaText)
    return
  }
  openURL(url)
}

function _onAppLink(action: AppGen.LinkPayload) {
  const link = action.payload.link
  let url
  try {
    url = new URL(link)
  } catch (e) {
    logger.info('AppLink: could not parse link', link)
    return
  }
  const username = Constants.urlToUsername(url)
  logger.info('AppLink: url', url.href, 'username', username)
  if (username) {
    return Saga.put(ProfileGen.createShowUserProfile({username}))
  }
}

function _outputInstructionsActionLink(
  action: ProfileGen.OutputInstructionsActionLinkPayload,
  state: TypedState
) {
  const profile = state.profile
  switch (profile.platform) {
    case 'twitter':
      return Saga.call(
        _openURLIfNotNull,
        profile.proofText,
        `https://twitter.com/home?status=${profile.proofText || ''}`,
        'twitter url'
      )
    case 'github':
      return Saga.call(openURL, 'https://gist.github.com/')
    case 'reddit':
      return Saga.call(_openURLIfNotNull, profile.proofText, profile.proofText, 'reddit url')
    case 'facebook':
      return Saga.call(_openURLIfNotNull, profile.proofText, profile.proofText, 'facebook url')
    case 'hackernews':
      return Saga.call(openURL, `https://news.ycombinator.com/user?id=${profile.username}`)
    default:
      break
  }
}

function _backToProfile() {
  return Saga.sequentially([
    Saga.put(TrackerGen.createGetMyProfile({})),
    Saga.put(navigateTo([], [peopleTab])),
  ])
}

function* _profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(ProfileGen.submitRevokeProof, _submitRevokeProof)
  yield Saga.safeTakeEveryPure(ProfileGen.backToProfile, _backToProfile)
  yield Saga.safeTakeEveryPure(ProfileGen.editProfile, _editProfile)
  yield Saga.safeTakeEveryPure(ProfileGen.finishRevoking, _finishRevoking)
  yield Saga.safeTakeEveryPure(ProfileGen.onClickAvatar, _onClickAvatar)
  yield Saga.safeTakeEveryPure(
    [ProfileGen.onClickFollowers, ProfileGen.onClickFollowing],
    _openProfileOrWebsite
  )
  yield Saga.safeTakeEveryPure(ProfileGen.outputInstructionsActionLink, _outputInstructionsActionLink)
  yield Saga.safeTakeEveryPure(ProfileGen.showUserProfile, _showUserProfile)
  yield Saga.safeTakeEveryPure(AppGen.link, _onAppLink)
}

function* profileSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.fork(_profileSaga)
  yield Saga.fork(pgpSaga)
  yield Saga.fork(proofsSaga)
}

export default profileSaga
