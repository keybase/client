// @flow
import Render from '.'
import type {DumbComponentMap} from '../../constants/types/more'

const common = {
  created: 1444423192000,
  currentDevice: false,
  deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  lastUsed: 1444423192001,
  name: 'Home Computer',
  onBack: () => { console.log('onBack') },
  provisionedAt: null,
  provisioner: null,
  revokedAt: null,
  showRevokeDevicePage: () => {},
  type: 'desktop',
}

const map: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': {
      ...common,
      banner: {
        desc: 'Home Computer is running an outdated version of Keybase. Remember to update!',
        type: 'OutOfDate',
      },
      currentDevice: true,
      device: common,
      deviceID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      // This is the max length, 64 chars.
      name: 'Hello this extremely long device name should not look very ugly',
      timeline: [
        {
          desc: 'Last used yesterday',
          type: 'LastUsed',
        },
        {
          desc: 'Added Mar 03, 2015',
          type: 'Added',
        },
      ],
    },
    'Paper': {
      ...common,
      device: common,
      deviceID: 'dddddddddddddddddddddddddddddddd',
      name: 'project green...',
      timeline: [
        {
          desc: 'Created Mar 03, 2014',
          subDesc: 'Home Computer',
          type: 'Added',
        },
      ],
      type: 'backup',
    },
    'Revoked': {
      ...common,
      currentDevice: false,
      device: common,
      deviceID: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      revokedAt: 1444423192000,
      timeline: [
        {
          desc: 'Revoked yesterday',
          subDesc: 'Home Computer',
          type: 'Revoked',
        },
        {
          desc: 'Last used Nov 12, 2015',
          subDesc: '83 days ago',
          type: 'LastUsed',
        },
        {
          desc: 'Added Mar 03, 2014',
          subDesc: 'Home Computer',
          type: 'Added',
        },
      ],
    },
    'Unlock': {
      ...common,
      banner: {
        desc: 'Turning on this device will unlock 6 of your private folders.',
        type: 'WillUnlock',
      },
      device: common,
      deviceID: 'cccccccccccccccccccccccccccccccc',
      name: 'Chris\'s iPhone',
      timeline: [
        {
          desc: 'Last used Mar 25, 2016',
          subDesc: '16 days ago',
          type: 'LastUsed',
        },
        {
          desc: 'Added Mar 03, 2015',
          subDesc: 'Home Computer',
          type: 'Added',
        },
      ],
      type: 'mobile',
    },
  },
}

export default {
  'Device Page': map,
}
