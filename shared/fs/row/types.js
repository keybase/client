// @flow
import * as Types from '../../constants/types/fs'
import * as React from 'react'

export type TlfTypeRowItem = {
  rowType: 'tlf-type',
  name: Types.TlfType,
}

export type TlfRowItem = {
  rowType: 'tlf',
  tlfType: Types.TlfType,
  name: string,
}

export type StillRowItem = {
  rowType: 'still',
  path: Types.Path,
  name: string,
}

export type EditingRowItem = {
  rowType: 'editing',
  editID: Types.EditID,
  name: string,
}

export type UploadingRowItem = {
  rowType: 'uploading',
  name: string,
  path: Types.Path,
}

export type PlaceholderRowItem = {
  rowType: 'placeholder',
  name: string,
  type: 'folder' | 'file',
}

export type EmptyRowItem = {
  rowType: 'empty',
}

export type HeaderRowItem = {
  rowType: 'header',
  height: number,
  node: React.Node,
}

export type RowItem =
  | TlfTypeRowItem
  | TlfRowItem
  | StillRowItem
  | EditingRowItem
  | UploadingRowItem
  | PlaceholderRowItem
  | EmptyRowItem
  | HeaderRowItem

export type RowItemWithKey =
  | ({key: string} & TlfTypeRowItem)
  | ({key: string} & TlfRowItem)
  | ({key: string} & StillRowItem)
  | ({key: string} & EditingRowItem)
  | ({key: string} & UploadingRowItem)
  | ({key: string} & PlaceholderRowItem)
  | ({key: string} & EmptyRowItem)
  | ({key: string} & HeaderRowItem)
