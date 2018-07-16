// @flow
import * as React from 'react'
import {action, storiesOf, createPropProvider} from '../../../../stories/storybook'
import * as PropProviders from '../../../../stories/prop-providers'
import {UsernameHeader} from '.'

const provider = createPropProvider(PropProviders.Common())

// const defaultProps = {
//   badgeNumber: 2,
//   canOpenInfoPanel: false,
//   channelName: 'general',
//   infoPanelOpen: false,
//   muted: false,
//   onBack: action('onBack'),
//   onCancelPending: action('onCancelPending'),
//   onOpenFolder: action('onOpenFolder'),
//   onShowProfile: action('onShowProfile'),
//   onToggleInfoPanel: action('onToggleInfoPanel'),
//   participants: ['nathunsmitty'],
//   smallTeam: true,
//   teamName: 'cool team',
// }

const defaultProps = {
  badgeNumber: 1,
  canOpenInfoPanel: true,
  channelName: '',
  infoPanelOpen: false,
  muted: false,
  onBack: action('onBack'),
  onCancelPending: null, // action('onCancelPending'),
  onOpenFolder: action('onOpenFolder'),
  onShowProfile: action('onShowProfile'),
  onToggleInfoPanel: action('onToggleInfoPanel'),
  participants: ['joshblum', 'ayoubd'],
  smallTeam: true,
  teamName: '',
}

const load = () => {
  storiesOf('Chat/Header', module)
    .addDecorator(provider)
    .add('Normal', () => <UsernameHeader {...defaultProps} />)
}

export default load
