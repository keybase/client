import type * as Types from '../../../constants/types/fs'
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
  name: Types.TlfType
  rowType: RowType.TlfType
  type: Types.PathType.Folder
}

export type TlfRowItem = {
  disabled: boolean
  isNew: boolean
  key: string
  name: string
  rowType: RowType.Tlf
  tlfMtime: number
  tlfType: Types.TlfType
  type: Types.PathType.Folder
}

export type StillRowItem = {
  editID?: Types.EditID // empty if not being renamed
  key: string
  lastModifiedTimestamp: number
  name: string
  path: Types.Path
  rowType: RowType.Still
  type: Types.PathType
}

export type NewFolderRowItem = {
  editType: Types.EditType
  editID: Types.EditID
  key: string
  name: string
  rowType: RowType.NewFolder
  type: Types.PathType.Folder
}

export type PlaceholderRowItem = {
  key: string
  name: string
  rowType: RowType.Placeholder
  type: Types.PathType.Folder | Types.PathType.File
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
