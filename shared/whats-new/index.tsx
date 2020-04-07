import React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Types from '../constants/types/whats-new'
import {isLinux} from '../constants/platform'
import {VersionProps} from './versions'

type Props = {
  // Releases
  Current?: React.ComponentType<VersionProps>
  Last?: React.ComponentType<VersionProps>
  LastLast?: React.ComponentType<VersionProps>
  currentVersion: Types.CurrentVersion
  lastVersion: Types.LastVersion
  lastLastVersion: Types.LastLastVersion
  noVersion: string
  seenVersions: {[key: string]: boolean}
  onBack: () => void
  onNavigate: (props: {
    fromKey?: string
    path: Array<{props?: {}; selected: string}>
    replace?: boolean
  }) => void
  onNavigateExternal: (url: string) => void
  // Updating
  updateAvailable: boolean
  updateMessage?: string
  onUpdateStart: () => void
  onUpdateSnooze: () => void
}

type UpdateAvailableProps = {
  message?: string
  onUpdateStart: () => void
  onUpdateSnooze: () => void
}

const UpdateAvailableBanner = (props: UpdateAvailableProps) => {
  const skipButtonLabel = isLinux ? 'Never notify me again' : 'Skip this version'
  const updateMessage = isLinux
    ? props.message || 'Update Keybase via your local package manager'
    : 'An update is available.'
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      alignItems="center"
      centerChildren={true}
      style={styles.updateAvailableContainer}
    >
      <Kb.Text type="BodySmallSemibold" center={true} style={styles.updateAvailableMessage}>
        {updateMessage}
      </Kb.Text>
      <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.updateAvailableButtonsContainer}>
        {!isLinux && (
          <Kb.Button
            type="Default"
            mode="Primary"
            backgroundColor="green"
            label="Install update"
            small={true}
            onClick={props.onUpdateStart}
          />
        )}
        <Kb.Button
          type="Default"
          mode="Secondary"
          backgroundColor="green"
          label={skipButtonLabel}
          small={true}
          onClick={props.onUpdateSnooze}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

// Need to switch the order of the scroll view on mobile and desktop so that contentBackground will fill the entire view
const Wrapper = ({children}: {children: React.ReactNode}) => (
  <Kb.Box2
    direction="vertical"
    alignItems="flex-start"
    alignSelf="flex-start"
    fullHeight={true}
    style={!Styles.isMobile && styles.popupContainer}
  >
    <Kb.Box2
      direction="vertical"
      alignItems="flex-start"
      alignSelf="flex-start"
      fullHeight={true}
      fullWidth={!Styles.isMobile}
      style={styles.contentBackground}
    >
      {Styles.isMobile ? (
        <Kb.ScrollView style={styles.scrollView}>
          <Kb.Box2
            direction="vertical"
            alignItems="flex-start"
            alignSelf="flex-start"
            style={styles.scrollViewInner}
          >
            {children}
          </Kb.Box2>
        </Kb.ScrollView>
      ) : (
        <Kb.ScrollView style={styles.scrollView}>{children}</Kb.ScrollView>
      )}
    </Kb.Box2>
  </Kb.Box2>
)

class WhatsNew extends React.PureComponent<Props> {
  static navigationOptions = {}
  componentWillUnmount() {
    this.props.onBack()
  }

  render() {
    const {
      currentVersion,
      lastVersion,
      lastLastVersion,
      noVersion,
      Current,
      Last,
      LastLast,
      seenVersions,
      onNavigate,
      onNavigateExternal,
      onUpdateStart,
      onUpdateSnooze,
      updateAvailable,
      updateMessage,
    } = this.props
    return (
      <Kb.Box2 direction="vertical">
        {updateAvailable && !Styles.isMobile && (
          <UpdateAvailableBanner
            message={updateMessage}
            onUpdateStart={onUpdateStart}
            onUpdateSnooze={onUpdateSnooze}
          />
        )}
        <Wrapper>
          {Current && (
            <Current
              seen={seenVersions[currentVersion]}
              onNavigate={onNavigate}
              onNavigateExternal={onNavigateExternal}
            />
          )}
          {lastVersion && lastVersion !== noVersion && Last && (
            <Last
              seen={seenVersions[lastVersion]}
              onNavigate={onNavigate}
              onNavigateExternal={onNavigateExternal}
            />
          )}
          {lastLastVersion && lastLastVersion !== noVersion && LastLast && (
            <LastLast
              seen={seenVersions[lastLastVersion]}
              onNavigate={onNavigate}
              onNavigateExternal={onNavigateExternal}
            />
          )}
        </Wrapper>
      </Kb.Box2>
    )
  }
}

const modalWidth = 288
const modalHeight = 500
const styles = Styles.styleSheetCreate(() => ({
  contentBackground: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
      ...Styles.globalStyles.rounded,
    },
    isElectron: {
      // Align menu edge with icon on desktop
      marginRight: Styles.globalMargins.xtiny,
    },
  }),
  popupContainer: Styles.platformStyles({
    isElectron: {
      height: modalHeight,
      maxHeight: modalHeight,
      maxWidth: modalWidth,
      width: modalWidth,
    },
  }),
  scrollView: Styles.platformStyles({
    common: {
      width: '100%',
    },
    isElectron: {
      ...Styles.padding(Styles.globalMargins.tiny),
    },
  }),
  scrollViewInner: Styles.platformStyles({
    isMobile: {
      marginBottom: Styles.globalMargins.small,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
    },
  }),
  updateAvailableButtonsContainer: {
    marginTop: Styles.globalMargins.xsmall,
  },
  updateAvailableContainer: {
    backgroundColor: Styles.globalColors.green,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.tiny,
  },
  updateAvailableMessage: {
    color: Styles.globalColors.white,
    paddingTop: Styles.globalMargins.tiny,
  },
  versionTitle: {
    color: Styles.globalColors.black_50,
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.xsmall,
  },
}))

export default WhatsNew
