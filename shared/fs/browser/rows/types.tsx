import * as Types from '../../../constants/types/fs'
import * as React from 'react'

export enum RowType {
  TlfType,
  Tlf,
  Still,
  Editing,
  Uploading,
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
  isNew: boolean
  key: string
  name: string
  rowType: RowType.Tlf
  tlfMtime: number
  tlfType: Types.TlfType
  type: Types.PathType.Folder
}

export type StillRowItem = {
  key: string
  lastModifiedTimestamp: number
  name: string
  path: Types.Path
  rowType: RowType.Still
  type: Types.PathType
}

export type EditingRowItem = {
  editType: Types.EditType
  editID: Types.EditID
  key: string
  name: string
  rowType: RowType.Editing
  type: Types.PathType
}

export type UploadingRowItem = {
  key: string
  name: string
  path: Types.Path
  rowType: RowType.Uploading
  type: Types.PathType
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

export type NamedRowItem =
  | TlfTypeRowItem
  | TlfRowItem
  | StillRowItem
  | EditingRowItem
  | UploadingRowItem
  | PlaceholderRowItem

export type RowItem = NamedRowItem | EmptyRowItem | HeaderRowItem
