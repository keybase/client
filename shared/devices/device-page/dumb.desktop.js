// @flow
import Render from './index.render.desktop'

const common = {
  type: 'desktop',
  name: 'Home Computer',
  isCurrent: false,
  isRevoked: false,
  timeline: null,
  banner: null,
  onRevoke: () => {}
}

export default {
  'Device Page': {
    component: Render,
    mocks: {
      'Normal': {
        ...common,
        isCurrent: true,
        timeline: [
          {type: 'LastUsed',
            desc: 'Last used yesterday'},
          {type: 'Added',
            desc: 'Added Mar 03, 2015'}
        ],
        banner: {
          type: 'OutOfDate',
          desc: 'Home Computer is running an outdated version of Keybase. Remember to update!'
        }
      },
      'Revoked': {
        ...common,
        isCurrent: false,
        isRevoked: true,
        timeline: [
          {type: 'Revoked',
            desc: 'Revoked yesterday',
            subDesc: 'Home Computer'},
          {type: 'LastUsed',
            desc: 'Last used Nov 12, 2015',
            subDesc: '83 days ago'},
          {type: 'Added',
            desc: 'Added Mar 03, 2014',
            subDesc: 'Home Computer'}
        ]
      },
      'Unlock': {
        ...common,
        name: 'Chris\'s iPhone',
        type: 'mobile',
        timeline: [
          {type: 'LastUsed',
            desc: 'Last used Mar 25, 2016',
            subDesc: '16 days ago'},
          {type: 'Added',
            desc: 'Added Mar 03, 2015',
            subDesc: 'Home Computer'}
        ],
        banner: {
          type: 'WillUnlock',
          desc: 'Turning on this device will unlock 6 of your private folders.'
        }
      },
      'Paper': {
        ...common,
        name: 'project green...',
        type: 'paperKey',
        timeline: [
          {type: 'Added',
            desc: 'Created Mar 03, 2014',
            subDesc: 'Home Computer'}
        ]
      }
    }
  }
}
