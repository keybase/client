import type * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as C from '@/constants'
import {currentVersion, lastVersion, lastLastVersion} from '@/stores/whats-new'
import type {VersionProps} from './versions'

type Props = {
  onNavigate: (props: C.Router2.PathParam) => void
  onNavigateExternal: (url: string) => void
  onSwitchTab: (tab: C.Tabs.AppTab) => void
  seenVersions: {[key: string]: boolean}
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
    style={!Kb.Styles.isMobile && styles.popupContainer}
  >
    <Kb.Box2
      direction="vertical"
      alignItems="flex-start"
      alignSelf="flex-start"
      fullHeight={true}
      fullWidth={!Kb.Styles.isMobile}
      style={styles.contentBackground}
    >
      {Kb.Styles.isMobile ? (
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

const WhatsNew = (props: Props) => {
  const {Current, Last} = props
  const {LastLast, seenVersions, onNavigate, onNavigateExternal, onSwitchTab} = props
  return (
    <Wrapper>
      {Current && (
        <Current
          seen={seenVersions[currentVersion] ?? false}
          onNavigate={onNavigate}
          onNavigateExternal={onNavigateExternal}
          onSwitchTab={onSwitchTab}
        />
      )}
      {lastVersion && Last && (
        <Last
          seen={seenVersions[lastVersion] ?? false}
          onNavigate={onNavigate}
          onNavigateExternal={onNavigateExternal}
          onSwitchTab={onSwitchTab}
        />
      )}
      {lastLastVersion && LastLast && (
        <LastLast
          seen={seenVersions[lastLastVersion] ?? false}
          onNavigate={onNavigate}
          onNavigateExternal={onNavigateExternal}
          onSwitchTab={onSwitchTab}
        />
      )}
    </Wrapper>
  )
}

const modalWidth = 288
const modalHeight = 500
const styles = Kb.Styles.styleSheetCreate(() => ({
  contentBackground: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.blueGrey,
      ...Kb.Styles.globalStyles.rounded,
    },
    isElectron: {
      // Align menu edge with icon on desktop
      marginRight: Kb.Styles.globalMargins.xtiny,
    },
  }),
  popupContainer: Kb.Styles.platformStyles({
    isElectron: {
      height: modalHeight,
      maxHeight: modalHeight,
      maxWidth: modalWidth,
      width: modalWidth,
    },
  }),
  scrollView: Kb.Styles.platformStyles({
    common: {
      width: '100%',
    },
    isElectron: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
    },
  }),
  scrollViewInner: Kb.Styles.platformStyles({
    isMobile: {
      marginBottom: Kb.Styles.globalMargins.small,
      marginLeft: Kb.Styles.globalMargins.small,
      marginRight: Kb.Styles.globalMargins.small,
      marginTop: Kb.Styles.globalMargins.small,
    },
  }),
  versionTitle: {
    color: Kb.Styles.globalColors.black_50,
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.xsmall,
  },
}))

export default WhatsNew
