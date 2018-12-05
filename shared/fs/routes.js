// @flow
import * as I from 'immutable'
import Files from './container'
import {isMobile} from '../constants/platform'
import {BarePreview, NormalPreview} from './filepreview'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import SecurityPrefs from './common/security-prefs-container'
import DestinationPicker from './destination-picker/container'

/*
 * Example Fs routes:
 *
 *   Mobile:
 *     /tabs:settings/settingsTab:fsTab/folder
 *       /keybase folder view
 *     /tabs:settings/settingsTab:fsTab/folder/folder/folder
 *       /keybase/team/keybase folder view
 *     /tabs:settings/settingsTab:fsTab/folder/folder/folder/preview
 *       file preview of some file under /keybase/team/keybase
 *     /tabs:settings/settingsTab:fsTab/destinationPicker/destinationPicker/destinationPicker
 *       moveOrCopy dialog showing /keybase/team/keybase
 *     /tabs:settings/settingsTab:fsTab/destinationPicker
 *       moveOrCopy dialog showing /keybase
 *
 * Note that folder and destinationPicker are siblings on mobile. This is to
 * make sure:
 *   1) foler view keeps all component layers mounted, so user can swipe back;
 *   2) moveOrCopy view keeps all layers mounted too, so user can swipe back to
 *      go to parent folder;
 *   3) we can use switchTo when user taps "Cancel" in the moveOrCopy dialog to
 *      switch back to whatever folder route that user was on before initiating
 *      moveOrCopy;
 *
 *   Desktop:
 *     /tabs:fsTab/folder
 *       /keybase folder view
 *     /tabs:fsTab/folder/folder/folder
 *       /keybase/team/keybase folder view
 *     /tabs:fsTab/folder/folder/folder/preview
 *       file preview of some file under /keybase/team/keybase
 *     /tabs:fsTab/folder/folder/folder/destinationPicker
 *       moveOrCopy dialog active when main view is in /keybase/team/keybase;
 *       doesn't matter what folder moveOrCopy dialog is showing
 *
 * Unlike mobile, with desktop destinationPicker is just a subroute of any
 * folder view. This is because:
 *   1) there's no "back" behavior we need to support;
 *   2) we need to go to arbitrary path without introducing another layer.
 * So just make moveOrCopy a single layer of destinationPicker on top of the
 * folder view, and use the redux store to bookkeep the currently showing path
 * in moveOrCopy.
 *
 * Note that in either case, we only store an index in routeProps, and have
 * container look for relevant information (destination's path, as well as
 * moving/copying target's path.
 *
 */

const _destinationPicker = {
  children: isMobile
    ? {
        destinationPicker: () => makeRouteDefNode(_destinationPicker),
      }
    : undefined,
  component: DestinationPicker,
  tags: makeLeafTags({
    layerOnTop: !isMobile,
    title: 'Move or Copy',
  }),
}

const _commonChildren = {
  securityPrefs: {
    component: SecurityPrefs,
  },
  ...(isMobile ? {} : {destinationPicker: () => makeRouteDefNode(_destinationPicker)}),
}

const _folderRoute = {
  children: {
    ..._commonChildren,
    barePreview: () =>
      makeRouteDefNode({
        children: _commonChildren,
        component: BarePreview,
        tags: makeLeafTags({
          fullscreen: true,
          title: 'Preview',
        }),
      }),
    folder: () => makeRouteDefNode(_folderRoute),
    preview: () =>
      makeRouteDefNode({
        children: _commonChildren,
        component: NormalPreview,
        tags: makeLeafTags({
          title: 'Preview',
        }),
      }),
  },
  component: Files,
}

const routeTree = makeRouteDefNode({
  children: {
    folder: () => makeRouteDefNode(_folderRoute),
    ...(isMobile ? {destinationPicker: () => makeRouteDefNode(_destinationPicker)} : {}),
  },
  defaultSelected: 'folder',
  initialState: {expandedSet: I.Set()},
  tags: makeLeafTags({title: 'Files'}),
})

export default routeTree
