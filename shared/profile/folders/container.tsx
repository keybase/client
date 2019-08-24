import * as FsGen from '../../actions/fs-gen'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import flags from '../../util/feature-flags'
import {namedConnect} from '../../util/container'
import Folders from '.'

type OwnProps = {
  profileUsername: string
}

const mapStateToProps = state => ({
  _ownUsername: state.config.username,
  _tlfs: state.fs.tlfs,
})

const mapDispatchToProps = dispatch => ({
  _openInFilesTab: (path: FsTypes.Path) => dispatch(FsConstants.makeActionForOpenPathInFilesTab(path)),
  loadTlfs: () => dispatch(FsGen.createFavoritesLoad()),
})

const mergeProps = (stateProps, dispatchProps, {profileUsername}: OwnProps) => ({
  loadTlfs: dispatchProps.loadTlfs,
  tlfs:
    profileUsername === stateProps._ownUsername // are we showing user's own profile?
      ? [
          // self public folder
          {
            isPublic: true,
            isSelf: true,
            openInFilesTab: () =>
              dispatchProps._openInFilesTab(
                FsTypes.stringToPath(`/keybase/public/${stateProps._ownUsername}`)
              ),
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
              isPublic: true,
              isSelf: false,
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/public/${tlfName}`)),
              text: `public/${tlfName}`,
            })),
          // self private folder
          {
            isPublic: false,
            isSelf: true,
            openInFilesTab: () =>
              dispatchProps._openInFilesTab(
                FsTypes.stringToPath(`/keybase/private/${stateProps._ownUsername}`)
              ),
            text: `private/${stateProps._ownUsername}`,
          },
          // all other favorited private folders
          ...stateProps._tlfs.private
            .keySeq()
            .filter(tlfName => tlfName !== stateProps._ownUsername)
            .map(tlfName => ({
              isPublic: false,
              isSelf: false,
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/private/${tlfName}`)),
              text: `private/${tlfName}`,
            })),
        ]
      : [
          // this's profile's public folder
          {
            isPublic: true,
            isSelf: true,
            openInFilesTab: () =>
              dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/public/${profileUsername}`)),
            text: `public/${profileUsername}`,
          },
          // other favorited public folders where the profile user is a member
          ...stateProps._tlfs.public
            .keySeq()
            .filter(tlfName => tlfName !== profileUsername && tlfName.split(/[,#]/).includes(profileUsername))
            .map(tlfName => ({
              isPublic: true,
              isSelf: false,
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/public/${tlfName}`)),
              text: `public/${tlfName}`,
            })),
          // all favorited private folders where the profile user is a member
          ...stateProps._tlfs.private
            .keySeq()
            .filter(tlfName => tlfName.split(/[,#]/).includes(profileUsername))
            .map(tlfName => ({
              isPublic: false,
              isSelf: false,
              openInFilesTab: () =>
                dispatchProps._openInFilesTab(FsTypes.stringToPath(`/keybase/private/${tlfName}`)),
              text: `private/${tlfName}`,
            })),
        ],
})
const hasFolders = namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedFolders')(Folders)

// @ts-ignore
const noFolders: typeof hasFolders = namedConnect(
  () => ({}),
  () => ({}),
  () => ({loadTlfs: () => {}, tlfs: []}),
  'ConnectedFolders'
)(Folders)

export default (flags.foldersInProfileTab ? hasFolders : noFolders)
