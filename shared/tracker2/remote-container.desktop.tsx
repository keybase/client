// Inside tracker we use an embedded Avatar which is connected.
import * as Electron from 'electron'
import * as React from 'react'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/tracker2'
import * as Container from '../util/container'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as Types from '../constants/types/tracker2'
import Tracker from './index.desktop'
import {DeserializeProps} from './remote-serializer.desktop'

const noDetails: Types.Details = {
  blocked: false,
  guiID: '',
  hidFromFollowers: false,
  reason: '',
  showTracker: false,
  state: 'checking',
  username: '',
}

export default () => {
  const state = Container.useRemoteStore<DeserializeProps>()
  const dispatch = Container.useDispatch()
  const {darkMode, trackerUsername, tracker2, config} = state
  const {usernameToDetails} = tracker2
  const details = usernameToDetails.get(trackerUsername) ?? noDetails
  const {assertions, bio, followersCount, followingCount} = details
  const {guiID, location, reason, state: trackerState, teamShowcase} = details
  return (
    <Tracker
      assertionKeys={assertions ? [...assertions.keys()] : undefined}
      bio={bio}
      darkMode={darkMode}
      followersCount={followersCount}
      followingCount={followingCount}
      guiID={guiID}
      isYou={config.username === trackerUsername}
      location={location}
      onAccept={() => dispatch(Tracker2Gen.createChangeFollow({follow: true, guiID}))}
      onChat={() => {
        dispatch(ConfigGen.createShowMain())
        dispatch(Chat2Gen.createPreviewConversation({participants: [trackerUsername], reason: 'tracker'}))
      }}
      onClose={() => {
        dispatch(Tracker2Gen.createCloseTracker({guiID}))
        // close immediately
        const w = Electron.remote.getCurrentWindow()
        w && w.close()
      }}
      onFollow={() => dispatch(Tracker2Gen.createChangeFollow({follow: true, guiID}))}
      onIgnoreFor24Hours={() => dispatch(Tracker2Gen.createIgnore({guiID}))}
      onReload={() =>
        dispatch(
          Tracker2Gen.createLoad({
            assertion: trackerUsername,
            forceDisplay: true,
            fromDaemon: false,
            guiID: Constants.generateGUIID(),
            ignoreCache: true,
            inTracker: true,
            reason: '',
          })
        )
      }
      reason={reason}
      state={trackerState}
      teamShowcase={teamShowcase}
      trackerUsername={trackerUsername}
    />
  )
}
