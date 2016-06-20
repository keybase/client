// @flow
import Render from './index.render'
import type {DumbComponentMap} from '../../constants/types/more'

const common = {
  type: 'desktop',
  name: 'Home Computer',
  deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  created: 1444423192000,
  currentDevice: false,
  revokedAt: null,
  provisioner: null,
  provisionedAt: null,
  lastUsed: 1444423192001,
  showRemoveDevicePage: () => {},
}

const map: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': {
      ...common,
      // This is the max length, 64 chars.
      name: 'Hello this extremely long device name should not look very ugly',
      deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      currentDevice: true,
      timeline: [
        {type: 'LastUsed',
          desc: 'Last used yesterday'},
        {type: 'Added',
          desc: 'Added Mar 03, 2015'},
      ],
      banner: {
        type: 'OutOfDate',
        desc: 'Home Computer is running an outdated version of Keybase. Remember to update!',
      },
      device: common,
    },

    'Revoked': {
      ...common,
      deviceID: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      currentDevice: false,
      revokedAt: 1444423192000,
      timeline: [
        {type: 'Revoked',
          desc: 'Revoked yesterday',
          subDesc: 'Home Computer'},
        {type: 'LastUsed',
          desc: 'Last used Nov 12, 2015',
          subDesc: '83 days ago'},
        {type: 'Added',
          desc: 'Added Mar 03, 2014',
          subDesc: 'Home Computer'},
      ],
      device: common,
    },
    'Unlock': {
      ...common,
      deviceID: 'cccccccccccccccccccccccccccccccc',
      name: 'Chris\'s iPhone',
      type: 'mobile',
      timeline: [
        {type: 'LastUsed',
          desc: 'Last used Mar 25, 2016',
          subDesc: '16 days ago'},
        {type: 'Added',
          desc: 'Added Mar 03, 2015',
          subDesc: 'Home Computer'},
      ],
      banner: {
        type: 'WillUnlock',
        desc: 'Turning on this device will unlock 6 of your private folders.',
      },
      device: common,
    },
    'Paper': {
      ...common,
      deviceID: 'dddddddddddddddddddddddddddddddd',
      name: 'project green...',
      type: 'backup',
      timeline: [
        {type: 'Added',
          desc: 'Created Mar 03, 2014',
          subDesc: 'Home Computer'},
      ],
      device: common,
    },
  },
}

export default {
  'Device Page': map,
}
