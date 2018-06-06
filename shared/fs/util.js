// @flow
import {fsTab} from '../constants/tabs'

export const folderLocation = (path : string) =>
  [fsTab, {props: {path}, selected: 'folder'}]
