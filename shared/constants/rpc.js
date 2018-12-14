// @flow
import {favoriteFolderType, type FolderType} from './types/rpc-gen'
import {invert} from 'lodash'

const folderTypeToString = invert(favoriteFolderType)

export const FolderTypeToString = (typ: FolderType) => folderTypeToString[typ]
