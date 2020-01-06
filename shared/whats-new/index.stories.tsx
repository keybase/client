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

const HeaderIconWrapper = (props: {children: React.ReactNode}) => (
  <Kb.Box2
    direction="vertical"
    style={styles.iconContainer}
    className={Styles.classNames('hover_container', 'hover_background_color_black_10')}
  >
    {props.children}
  </Kb.Box2>
)

const UpdateAvailableWrapper = (props: {children: React.ReactNode}) => (
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

const commonProps = {
  currentVersion,
  lastLastVersion,
  lastVersion,
  noVersion,
  onBack: Sb.action('onBack'),
  onNavigate: Sb.action('onNavigate'),
  onNavigateExternal: Sb.action('onNavigateExternal'),
  onUpdateSnooze: Sb.action('onUpdateSnooze'),
  onUpdateStart: Sb.action('onUpdateStart'),
  updateAvailable: false,
}

const load = () => {
  Sb.storiesOf("What's New/Icon", module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Nothing New', () => (
      <HeaderIconWrapper>
        <HeaderIcon newRelease={false} isProfileHeader={false} onClick={Sb.action('onClick')} />
      </HeaderIconWrapper>
    ))
    .add('New Release', () => (
      <>
        <HeaderIconWrapper>
          <HeaderIcon newRelease={true} isProfileHeader={false} onClick={Sb.action('onClick')} />
        </HeaderIconWrapper>
        <HeaderIconWrapper>
          <HeaderIcon newRelease={true} isProfileHeader={false} onClick={Sb.action('onClick')} />
        </HeaderIconWrapper>
      </>
    ))
    .add('Update Available', () => (
      <UpdateAvailableWrapper>
        <IconWithPopup
          newRelease={false}
          updateAvailable={true}
          isProfileHeader={false}
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
    .add('Images', () => {
      const images = newFeatures.map((feature, index) => (
        <NewFeatureWrapper key={index}>
          <NewFeatureRow
            noSeparator={true}
            onPrimaryButtonClick={Sb.action('onPrimaryButtonClick')}
            onSecondaryButtonClick={Sb.action('onSecondaryButtonClick')}
            {...feature}
            seen={true}
            image="release-4.7.0-dark-mode"
          >
            {feature.text}
          </NewFeatureRow>
        </NewFeatureWrapper>
      ))

      return images
    })

  Sb.storiesOf("What's New/Versions", module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('One Version - Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          seenVersions={{
            [currentVersion]: false,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('One Version - Seen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          seenVersions={{
            [currentVersion]: true,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('Two Versions - All Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          Last={Last}
          seenVersions={{
            [currentVersion]: false,
            [lastVersion]: false,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('Two Versions - Current Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          Last={Last}
          seenVersions={{
            [currentVersion]: false,
            [lastVersion]: true,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('Two Versions - All Seen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          Last={Last}
          seenVersions={{
            [currentVersion]: true,
            [lastVersion]: true,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - All Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          seenVersions={{
            [currentVersion]: false,
            [lastLastVersion]: false,
            [lastVersion]: false,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - Current Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          seenVersions={{
            [currentVersion]: false,
            [lastLastVersion]: true,
            [lastVersion]: true,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - Current&Last Unseen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          seenVersions={{
            [currentVersion]: false,
            [lastLastVersion]: true,
            [lastVersion]: false,
          }}
        />
      </WhatsNewWrapper>
    ))
    .add('Three Versions - All Seen', () => (
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          seenVersions={{
            [currentVersion]: true,
            [lastLastVersion]: true,
            [lastVersion]: true,
          }}
        />
      </WhatsNewWrapper>
    ))

  Sb.storiesOf("What's New/Update Available", module).add('Update Available', () => (
    <Kb.Box2 direction="horizontal" gap="small">
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          updateAvailable={true}
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          seenVersions={{
            [currentVersion]: false,
            [lastLastVersion]: false,
            [lastVersion]: false,
          }}
        />
      </WhatsNewWrapper>
      <WhatsNewWrapper>
        <WhatsNew
          {...commonProps}
          updateAvailable={true}
          updateMessage="Update Keybase via your local package manager"
          Current={Current}
          Last={Last}
          LastLast={LastLast}
          seenVersions={{
            [currentVersion]: true,
            [lastLastVersion]: true,
            [lastVersion]: true,
          }}
        />
      </WhatsNewWrapper>
    </Kb.Box2>
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
  whatsNewWrapper: {
    flexWrap: 'wrap',
    marginTop: Styles.globalMargins.small,
    maxHeight: modalHeight,
    maxWidth: modalWidth,
  },
}))

export default load
