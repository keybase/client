/* @flow */
import ConfirmClearHistory from './clear-history.render'
import ConfirmDelete from './delete.render'
import ConfirmIgnore from './ignore.render'
import type {DumbComponentMap} from '../../constants/types/more'
import {isMobile} from '../../constants/platform'

const parentPropsCommon = isMobile ? {} : {style: {display: 'flex', width: 640, height: 580, outline: '1px solid lightgray'}}

export const clearHistoryMap: DumbComponentMap<ConfirmClearHistory> = {
  component: ConfirmClearHistory,
  mocks: {
    'Normal - Public': {
      parentProps: parentPropsCommon,
      isPrivate: false,
      folderSize: '3.14 MB',
      users: [
        {username: 'cecileb', you: true},
        {username: 'aliceb'},
      ],
      onSubmit: () => console.log('onSubmit'),
      onCancel: () => console.log('onCancel'),
    },
    'Normal - Private': {
      parentProps: parentPropsCommon,
      isPrivate: true,
      folderSize: '3.14 MB',
      users: [
        {username: 'cecileb', you: true},
        {username: 'aliceb'},
      ],
      onSubmit: () => console.log('onSubmit'),
      onCancel: () => console.log('onCancel'),
    },
    'Long Name - Public': {
      parentProps: parentPropsCommon,
      isPrivate: false,
      folderSize: '999.99 MB',
      users: [
        {username: 'cecileb', you: true},
        {username: 'aliceb'},
        {username: 'strib'},
        {username: 'max'},
        {username: 'chris'},
        {username: 'gabrielh'},
        {username: 'marcopolo'},
        {username: 'patrick'},
        {username: 'akalin'},
        {username: 'jzila'},
        {username: 'cjb'},
        {username: 'mgood'},
      ],
      onSubmit: () => console.log('onSubmit'),
      onCancel: () => console.log('onCancel'),
    },
  },
}

export const deleteMap: DumbComponentMap<ConfirmDelete> = {
  component: ConfirmDelete,
  mocks: {
    'Normal - Public': {
      parentProps: parentPropsCommon,
      isPrivate: false,
      folderSize: '5.17 GB',
      users: [
        {username: 'cecileb', you: true},
        {username: 'aliceb'},
      ],
      onSubmit: () => console.log('onSubmit'),
      onCancel: () => console.log('onCancel'),
    },
    'Normal - Private': {
      parentProps: parentPropsCommon,
      isPrivate: true,
      folderSize: '5.17 GB',
      users: [
        {username: 'cecileb', you: true},
        {username: 'aliceb'},
      ],
      onSubmit: () => console.log('onSubmit'),
      onCancel: () => console.log('onCancel'),
    },
  },
}

export const ignoreMap: DumbComponentMap<ConfirmIgnore> = {
  component: ConfirmIgnore,
  mocks: {
    'Normal - Public': {
      parentProps: parentPropsCommon,
      isPrivate: false,
      users: [
        {username: 'cecileb', you: true},
        {username: 'aliceb'},
      ],
      avatar: 'cecileb',
      onSubmit: () => console.log('onSubmit'),
      onCancel: () => console.log('onCancel'),
    },
    'Normal - Private': {
      parentProps: parentPropsCommon,
      isPrivate: true,
      users: [
        {username: 'cecileb', you: true},
        {username: 'aliceb'},
      ],
      avatar: 'cecileb',
      onSubmit: () => console.log('onSubmit'),
      onCancel: () => console.log('onCancel'),
    },
  },
}

export default {
  'Folders Clear History Confirmation': clearHistoryMap,
  'Folders Delete Confirmation': deleteMap,
  'Folders Ignore Confirmation': ignoreMap,
}
