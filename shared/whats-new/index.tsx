import React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Types from '../constants/types/whats-new'
import {VersionProps} from './versions'

type Props = {
  onBack: () => void
  onNavigate: (props: {
    fromKey?: string
    path: Array<{props?: {}; selected: string}>
    replace?: boolean
  }) => void
  onNavigateExternal: (url: string) => void
  seenVersions: {[key: string]: boolean}
  currentVersion: Types.CurrentVersion
  lastVersion: Types.LastVersion
  lastLastVersion: Types.LastLastVersion
  noVersion: string
  Current?: React.ComponentType<VersionProps>
  Last?: React.ComponentType<VersionProps>
  LastLast?: React.ComponentType<VersionProps>
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
    } = this.props
    return (
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
    )
  }
}

const modalWidth = 288
const modalHeight = 424
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
  versionTitle: {
    color: Styles.globalColors.black_50,
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.xsmall,
  },
}))

export default WhatsNew
