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
            subDesc: 'by Home Computer'},
          {type: 'LastUsed',
            desc: 'Last used Nov 12, 2015',
            subDesc: '83 days ago'},
          {type: 'Added',
            desc: 'Added Mar 03, 2014',
            subDesc: 'by Home Computer'}
        ]
      }
    }
  }
}
