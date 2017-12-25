// @flow
import * as RPCTypes from './rpc-gen'
import type {Exact} from './more'
type ListState = any
// TODO this is super messy and there some entangled flow error. let's revisit this soon
/* {
  tlfs?: Array<Folder>,
  ignored?: Array<Folder>,
  isPublic: boolean,
  style?: any,
  smallMode?: boolean,
  onClick?: (path: string) => void,
  onRekey?: (path: string) => void,
  onOpen?: (path: string) => void,
  onChat?: (tlf: string) => void,
  onToggleShowIgnored?: ?() => void,
  showIgnored?: boolean,
  extraRows?: Array<React.Node>,
} */

export type FolderState = {
  privateBadge: number,
  private: ListState,
  publicBadge: number,
  public: ListState,
}

export type ViewState = Exact<{
  showingPrivate: boolean,
  publicIgnoredOpen: boolean,
  privateIgnoredOpen: boolean,
}>

export type KBFSStatus = {
  isAsyncWriteHappening: boolean,
}

export type State = Exact<{
  folderState: FolderState,
  fuseInstalling: boolean,
  fuseStatus: ?RPCTypes.FuseStatus,
  fuseStatusLoading: boolean,
  kbfsInstalling: boolean,
  kbfsOpening: boolean,
  kbfsStatus: KBFSStatus,
  kextPermissionError: boolean,
  viewState: ViewState,
}>
