// @flow
import {RouteDefNode} from '../route-tree'
import {PrivateFolders, PublicFolders} from './'
import Files from './files'
import PaperKey from './files/paperkey'

const filesSubTree = (darkStatusBarContent = false) => ({
  files: {
    component: Files,
    tags: {
      showStatusBarDarkContent: darkStatusBarContent,
      underStatusBar: true,
    },
    children: {
      paperkey: {
        component: PaperKey,
      },
    },
  },
})

const routeTree = new RouteDefNode({
  defaultSelected: 'private',
  children: {
    private: {
      component: PrivateFolders,
      initialState: {showingIgnored: false},
      tags: {underStatusBar: true},
      children: filesSubTree(),
    },
    public: {
      component: PublicFolders,
      initialState: {showingIgnored: false},
      tags: {showStatusBarDarkContent: true, underStatusBar: true},
      children: filesSubTree(true),
    },
  },
})

export default routeTree
