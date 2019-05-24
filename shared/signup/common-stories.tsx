import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Sb from '../stories/storybook'
import * as Styles from '../styles'

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

const propProvider = Sb.createPropProviderWithCommon({
  SignupInfoIcon: p => ({
    ...p,
    onDocumentation: Sb.action('onDocumentation'),
    onFeedback: Sb.action('onFeedback'),
  }),
})
export const storyDecorator = (story: Function) => (
  // @ts-ignore
  <Kb.Box style={decoratorStyle}>{propProvider(story)}</Kb.Box>
)
