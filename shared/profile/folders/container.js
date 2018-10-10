// @flow
import * as FsGen from '../../actions/fs-gen'
import * as FsTypes from '../../constants/types/fs'
import flags from '../../util/feature-flags'
import {compose, connect, setDisplayName} from '../../util/container'
import Folders from '.'

const mapStateToProps = state => ({
  _tlfs: state.fs.tlfs,
  _ownUsername: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  _openInFilesTab: (path: FsTypes.Path) => dispatch(FsGen.createOpenPathInFilesTab({path})),
  loadTlfs: () => dispatch(FsGen.createFavoritesLoad()),
})

const mergeProps = (stateProps, dispatchProps, {profileUsername}) => ({
  tlfs:
    profileUsername === stateProps._ownUsername // are we showing user's own profile?
      ? [
          // self public folder
          {
            openInFilesTab: () =>
              dispatchProps._openInFilesTab(
                FsTypes.stringToPath(`/keybase/public/${stateProps._ownUsername}`)
              ),
            isPublic: true,
            isSelf: true,
            text: `public/${stateProps._ownUsername}`,
          },
          // other favorited public folders where self is a member
          ...stateProps._tlfs.public
            .keySeq()
            .filter(
              tlfName =>
                tlfName !== stateProps._ownUsername && tlfName.split(/[,#]/).includes(stateProps._ownUsername)
            )
            .map(tlfName => ({
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/public/${tlfName}`)),
              isPublic: true,
              isSelf: false,
              text: `public/${tlfName}`,
            })),
          // self private folder
          {
            openInFilesTab: () =>
              dispatchProps._openInFilesTab(
                FsTypes.stringToPath(`/keybase/private/${stateProps._ownUsername}`)
              ),
            isPublic: false,
            isSelf: true,
            text: `private/${stateProps._ownUsername}`,
          },
          // all other favorited private folders
          ...stateProps._tlfs.private
            .keySeq()
            .filter(tlfName => tlfName !== stateProps._ownUsername)
            .map(tlfName => ({
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/private/${tlfName}`)),
              isPublic: false,
              isSelf: false,
              text: `private/${tlfName}`,
            })),
        ]
      : [
          // this's profile's public folder
          {
            openInFilesTab: () =>
              dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/public/${profileUsername}`)),
            isPublic: true,
            isSelf: true,
            text: `public/${profileUsername}`,
          },
          // other favorited public folders where the profile user is a member
          ...stateProps._tlfs.public
            .keySeq()
            .filter(tlfName => tlfName !== profileUsername && tlfName.split(/[,#]/).includes(profileUsername))
            .map(tlfName => ({
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/public/${tlfName}`)),
              isPublic: true,
              isSelf: false,
              text: `public/${tlfName}`,
            })),
          // all favorited private folders where the profile user is a member
          ...stateProps._tlfs.private
            .keySeq()
            .filter(tlfName => tlfName.split(/[,#]/).includes(profileUsername))
            .map(tlfName => ({
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/private/${tlfName}`)),
              isPublic: false,
              isSelf: false,
              text: `private/${tlfName}`,
            })),
        ],
  loadTlfs: dispatchProps.loadTlfs,
})

export default compose(
  flags.admin
    ? connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
      )
    : connect(
        () => ({}),
        () => ({}),
        () => ({tlfs: [], loadTlfs: () => {}})
      ),
  setDisplayName('ConnectedFolders')
)(Folders)
