// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import JoinOrLogin from '.'

const props = {
  onCreateAccount: Sb.action('onCreateAccount'),
  onDocumentation: Sb.action('onDocumentation'),
  onFeedback: Sb.action('onFeedback'),
  onLogin: Sb.action('onLogin'),
}

const decoratorStyle = Styles.platformStyles({
  isElectron: {
    border: `1px solid ${Styles.globalColors.black_10}`,
    borderRadius: Styles.borderRadius,
    height: '500px',
    margin: Styles.globalMargins.tiny,
    width: '500px',
  },
  isMobile: {
    height: '100%',
    width: '100%',
  },
})

const load = () => {
  Sb.storiesOf('New signup', module)
    .addDecorator(story => <Kb.Box style={decoratorStyle}>{story()}</Kb.Box>)
    .add('Join or login', () => <JoinOrLogin {...props} />)
}

export default load
