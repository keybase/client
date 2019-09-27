import React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import HeaderIcon from './header-icon'
import NewFeature from './new-feature'

const commonNewFeatureProps = {
  primaryButton: false,
  secondaryButton: false,
  seen: false,
  text: '',
}

const newFeatures = [
  {
    ...commonNewFeatureProps,
    text: 'Some short text',
  },
  {
    ...commonNewFeatureProps,
    text:
      'Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever.',
  },
  {
    ...commonNewFeatureProps,
    primaryButton: true,
    primaryButtonText: 'Try it out',
    secondaryButton: true,
    secondaryButtonText: 'No way',
    text:
      'Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever.',
  },
  {
    ...commonNewFeatureProps,
    primaryButton: true,
    primaryButtonText: 'Lots to do on this button',
    secondaryButton: true,
    secondaryButtonText: 'Lots here as well',
    text: 'Short text but long button text',
  },
]

const NewFeatureWrapper = ({children}) => (
  <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.newFeatureContainer}>
    {children}
  </Kb.Box2>
)

const load = () => {
  Sb.storiesOf('Whats New', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Radio Icon - Nothing New', () => <HeaderIcon newFeatures={false} />)
    .add('Radio Icon - New Features', () => <HeaderIcon newFeatures={true} />)
    .add('New Feature Row', () =>
      newFeatures.map((feature, index) => (
        <NewFeatureWrapper key={index}>
          <NewFeature {...feature} />
        </NewFeatureWrapper>
      ))
    )
}

const modalWidth = 284
const modalHeight = 424

const styles = Styles.styleSheetCreate(() => ({
  newFeatureContainer: {
    backgroundColor: Styles.globalColors.blueGrey,
    marginTop: 20,
    maxHeight: modalHeight,
    maxWidth: modalWidth,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 8,
  },
}))

export default load
