import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {Version, VersionTitle, VersionProps} from './versions'
import {currentVersion, lastVersion, lastLastVersion} from '../constants/whats-new'
import HeaderIcon, {IconWithPopup} from './icon/'
import NewFeatureRow from './new-feature-row'
import WhatsNew from '.'

const commonNewFeatureProps = {
  primaryButtonText: undefined,
  secondaryButtonText: undefined,
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
    primaryButtonText: 'Try it out',
    secondaryButtonText: 'Read the docs',
    text:
      'Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever. Some very very long text that goes on forever and ever.',
  },
  {
    ...commonNewFeatureProps,
    primaryButtonText: 'Lots to do on this button',
    secondaryButtonText: 'Lots here as well',
    text: 'Short text but long button text',
  },
]

const HeaderIconWrapper = props => (
  <Kb.Box2
    direction="vertical"
    style={styles.iconContainer}
    className={Styles.classNames('hover_container', 'hover_background_color_black_10')}
  >
    {props.children}
  </Kb.Box2>
)

const UpdateAvailableWrapper = props => (
  <Kb.Box2
    direction="vertical"
    style={{
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      width: 200,
    }}
  >
    {props.children}
  </Kb.Box2>
)

const NewFeatureWrapper = ({children}) => (
  <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.newFeatureWrapper}>
    {children}
  </Kb.Box2>
)

const WhatsNewWrapper = ({children}) => (
  <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.whatsNewWrapper}>
    {children}
  </Kb.Box2>
)

const Current = (props: VersionProps) => (
  <Version>
    <NewFeatureRow seen={props.seen}>Current</NewFeatureRow>
  </Version>
)
const Last = (props: VersionProps) => (
  <Version>
    <VersionTitle title="Last Release" />
    <NewFeatureRow seen={props.seen}>Last</NewFeatureRow>
  </Version>
)
const LastLast = (props: VersionProps) => (
  <Version>
    <VersionTitle title="Last Last Release" />
    <NewFeatureRow seen={props.seen}>Last Last</NewFeatureRow>
  </Version>
)

const noVersion = '0.0.1'

const load = () => {
  Sb.storiesOf("What's New/Icon", module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Nothing New', () => (
      <HeaderIconWrapper>
        <HeaderIcon newRelease={false} onClick={Sb.action('onClick')} />
      </HeaderIconWrapper>
    ))
    .add('New Release', () => (
      <>
        <HeaderIconWrapper>
          <HeaderIcon newRelease={true} onClick={Sb.action('onClick')} />
        </HeaderIconWrapper>
        <HeaderIconWrapper>
          <HeaderIcon
            newRelease={true}
            badgeColor={Styles.globalColors.black}
            onClick={Sb.action('onClick')}
          />
        </HeaderIconWrapper>
      </>
    ))
    .add('Update Available', () => (
      <UpdateAvailableWrapper>
        <IconWithPopup
          newRelease={false}
          updateAvailable={true}
          attachToRef={React.createRef<Kb.Box2>()}
          onClick={Sb.action('onClick')}
        />
      </UpdateAvailableWrapper>
    ))

  Sb.storiesOf("What's New/New Feature Row", module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Unseen', () => {
      const unseen = newFeatures.map((feature, index) => (
        <NewFeatureWrapper key={index}>
          <NewFeatureRow
            noSeparator={true}
            onPrimaryButtonClick={Sb.action('onPrimaryButtonClick')}
            onSecondaryButtonClick={Sb.action('onSecondaryButtonClick')}
            {...feature}
          >
            {feature.text}
          </NewFeatureRow>
        </NewFeatureWrapper>
      ))

      return [unseen]
    })
    .add('Seen', () => {
      const seen = newFeatures.map((feature, index) => (
        <NewFeatureWrapper key={index}>
          <NewFeatureRow
            noSeparator={true}
            onPrimaryButtonClick={Sb.action('onPrimaryButtonClick')}
            onSecondaryButtonClick={Sb.action('onSecondaryButtonClick')}
            {...feature}
            seen={true}
          >
            {feature.text}
          </NewFeatureRow>
        </NewFeatureWrapper>
      ))

      return seen
    })
    .add('Square Image', () => {
      const squareImages = newFeatures.map((feature, index) => (
        <NewFeatureWrapper key={index}>
          <NewFeatureRow
            noSeparator={true}
            onPrimaryButtonClick={Sb.action('onPrimaryButtonClick')}
            onSecondaryButtonClick={Sb.action('onSecondaryButtonClick')}
            {...feature}
            seen={true}
            image="release-4.7.0-keybase-fm"
          >
            {feature.text}
          </NewFeatureRow>
        </NewFeatureWrapper>
      ))

      return squareImages
    })
    .add('Round Image', () => {
      const squareImages = newFeatures.map((feature, index) => (
        <NewFeatureWrapper key={index}>
          <NewFeatureRow
            noSeparator={true}
            onPrimaryButtonClick={Sb.action('onPrimaryButtonClick')}
            onSecondaryButtonClick={Sb.action('onSecondaryButtonClick')}
            {...feature}
            seen={true}
            image="release-4.7.0-dark-mode"
            imageStyle={styles.roundedImage}
          >
            {feature.text}
          </NewFeatureRow>
        </NewFeatureWrapper>
      ))

      return squareImages
    })

  Sb.storiesOf("What's New/Versions", module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('One Version - Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          noVersion={noVersion}
          seenVersions={{
            [currentVersion]: false,
          }}
          Current={Current}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('One Version - Seen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          noVersion={noVersion}
          seenVersions={{
            [currentVersion]: true,
          }}
          Current={Current}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('Two Versions - All Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          noVersion={noVersion}
          seenVersions={{
            [currentVersion]: false,
            [lastVersion]: false,
          }}
          Current={Current}
          Last={Last}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('Two Versions - Current Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          seenVersions={{
            [currentVersion]: false,
            [lastVersion]: true,
          }}
          Current={Current}
          Last={Last}
          noVersion={noVersion}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('Two Versions - All Seen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          noVersion={noVersion}
          seenVersions={{
            [currentVersion]: true,
            [lastVersion]: true,
          }}
          Current={Current}
          Last={Last}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - All Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          noVersion={noVersion}
          seenVersions={{
            [currentVersion]: false,
            [lastLastVersion]: false,
            [lastVersion]: false,
          }}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - Current Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          seenVersions={{
            [currentVersion]: false,
            [lastLastVersion]: true,
            [lastVersion]: true,
          }}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          noVersion={noVersion}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - Current&Last Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          seenVersions={{
            [currentVersion]: false,
            [lastLastVersion]: true,
            [lastVersion]: false,
          }}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          noVersion={noVersion}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - All Seen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          currentVersion={currentVersion}
          lastVersion={lastVersion}
          lastLastVersion={lastLastVersion}
          noVersion={noVersion}
          seenVersions={{
            [currentVersion]: true,
            [lastLastVersion]: true,
            [lastVersion]: true,
          }}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          onBack={Sb.action('onBack')}
          onNavigate={Sb.action('onNavigate')}
          onNavigateExternal={Sb.action('onNavigateExternal')}
        />
      </WhatsNewWrapper>
    ))
}

const modalWidth = 284
const modalHeight = 424

const styles = Styles.styleSheetCreate(() => ({
  iconContainer: {
    alignItems: 'center',
    borderRadius: Styles.borderRadius,
    height: 25,
    justifyContent: 'center',
    margin: Styles.globalMargins.small,
    padding: Styles.globalMargins.xtiny,
    // Needed to position blue badge
    position: 'relative',
    // Fix width since story container wants to be width: 100%
    width: 24,
  },
  newFeatureWrapper: {
    ...Styles.globalStyles.rounded,
    ...Styles.padding(Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.blueGrey,
    flexWrap: 'wrap',
    marginTop: Styles.globalMargins.small,
    maxHeight: modalHeight,
    maxWidth: modalWidth,
  },
  roundedImage: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.grey,
      borderWidth: Styles.globalMargins.xxtiny,
    },
    isElectron: {
      // Pass borderRadius as a number to the image on mobile using collapseStyles
      borderRadius: '100%',
      borderStyle: 'solid',
    },
  }),
  whatsNewWrapper: {
    flexWrap: 'wrap',
    marginTop: Styles.globalMargins.small,
    maxHeight: modalHeight,
    maxWidth: modalWidth,
  },
}))

export default load
