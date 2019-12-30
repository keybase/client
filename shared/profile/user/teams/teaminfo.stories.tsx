import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import TeamInfo from './teaminfo'

const defaultProps = {
  attachTo: Sb.action('mocked'),
  description: 'Building Keybase one bit at a time',
  inTeam: true,
  isOpen: false,
  membersCount: 28,
  name: 'keybase',
  onChat: Sb.action('onChat'),
  onHidden: Sb.action('onHidden'),
  onJoinTeam: (_: string) => Sb.action('onJoinTeam'),
  onViewTeam: Sb.action('onViewTeam'),
  publicAdmins: [],
  visible: true,
}
const load = () => {
  Sb.storiesOf('Profile', module).add('TeamInfo', () => <TeamInfo {...defaultProps} />)
}

// const styles = Styles.styleSheetCreate(() => ({
//     container: {
//         backgroundColor: Styles.globalColors.red,
//         height: 20,
//         position: 'relative',
//         width: 20,
//     },
// }))

export default load
