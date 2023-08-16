import type * as T from '../../../constants/types'
import type * as React from 'react'

export enum RowType {
  TlfType,
  Tlf,
  Still,
  NewFolder,
  Placeholder,
  Empty,
  Header,
}

export type TlfTypeRowItem = {
  key: string
  name: T.FS.TlfType
  rowType: RowType.TlfType
  type: T.FS.PathType.Folder
}

export type TlfRowItem = {
  disabled: boolean
  isNew: boolean
  key: string
  name: string
  rowType: RowType.Tlf
  tlfMtime: number
  tlfType: T.FS.TlfType
  type: T.FS.PathType.Folder
}

export type StillRowItem = {
  editID?: T.FS.EditID // empty if not being renamed
  key: string
  lastModifiedTimestamp: number
  name: string
  path: T.FS.Path
  rowType: RowType.Still
  type: T.FS.PathType
}

export type NewFolderRowItem = {
  editType: T.FS.EditType
  editID: T.FS.EditID
  key: string
  name: string
  rowType: RowType.NewFolder
  type: T.FS.PathType.Folder
}

export type PlaceholderRowItem = {
  key: string
  name: string
  rowType: RowType.Placeholder
  type: T.FS.PathType.Folder | T.FS.PathType.File
}

export type EmptyRowItem = {
  key: string
  rowType: RowType.Empty
}

export type HeaderRowItem = {
  key: string
  rowType: RowType.Header
  height: number
  node: React.ReactElement
}

export type NamedRowItem = TlfTypeRowItem | TlfRowItem | StillRowItem | NewFolderRowItem | PlaceholderRowItem

export type RowItem = NamedRowItem | EmptyRowItem | HeaderRowItem
