import {FolderType} from './types/rpc-gen'
import {invert} from 'lodash-es'

const folderTypeToString = invert(FolderType)

export const FolderTypeToString = (typ: FolderType) => folderTypeToString[typ]
