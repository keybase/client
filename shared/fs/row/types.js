// @flow
import * as Types from '../../constants/types/fs'
import * as React from 'react'

export type TlfTypeRowItem = {
  key: string,
  name: Types.TlfType,
  rowType: 'tlf-type',
  type: 'folder',
}

export type TlfRowItem = {
  isNew: boolean,
  key: string,
  name: string,
  rowType: 'tlf',
  tlfType: Types.TlfType,
  type: 'folder',
}

export type StillRowItem = {
  key: string,
  lastModifiedTimestamp: number,
  name: string,
  path: Types.Path,
  rowType: 'still',
  type: Types.PathType,
}

export type EditingRowItem = {
  editType: Types.EditType,
  editID: Types.EditID,
  key: string,
  name: string,
  rowType: 'editing',
  type: Types.PathType,
}

export type UploadingRowItem = {
  key: string,
  name: string,
  path: Types.Path,
  rowType: 'uploading',
  type: Types.PathType,
}

export type PlaceholderRowItem = {
  key: string,
  name: string,
  rowType: 'placeholder',
  type: 'folder' | 'file',
}

export type EmptyRowItem = {
  key: string,
  rowType: 'empty',
}

export type HeaderRowItem = {
  key: string,
  rowType: 'header',
  height: number,
  node: React.Node,
}

export type NamedRowItem =
  | TlfTypeRowItem
  | TlfRowItem
  | StillRowItem
  | EditingRowItem
  | UploadingRowItem
  | PlaceholderRowItem

export type RowItem = NamedRowItem | EmptyRowItem | HeaderRowItem
