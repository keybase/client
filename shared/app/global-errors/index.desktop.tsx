import * as React from 'react'
import logger from '@/logger'
import * as Kb from '@/common-adapters'
import {ignoreDisconnectOverlay} from '@/local-debug.desktop'
import useData, {type Size} from './hook'

const maxHeightForSize = (size: Size) => {
  return {
    Big: 900,
    Closed: 0,
    Small: 35,
  }[size]
}

const GlobalError = () => {
  const d = useData()
  const {daemonError, error, onDismiss, onFeedback} = d
  const {cachedDetails, cachedSummary, size, onExpandClick} = d

  if (size === 'Closed') {
    return null
  }

  if (!daemonError && !error) {
    return null
  }

  if (daemonError) {
    if (ignoreDisconnectOverlay) {
      logger.warn('Ignoring disconnect overlay')
      return null
    }

    const message = daemonError.message || 'Keybase is currently unreachable. Trying to reconnect you…'
    return (
      <Kb.Box style={styles.containerOverlay}>
        <Kb.Box style={styles.overlayRow}>
          <Kb.Text center={true} type="BodySmallSemibold" style={styles.message}>
            {message}
          </Kb.Text>
        </Kb.Box>
        <Kb.Box style={styles.overlayFill}>
          <Kb.Animation animationType="disconnected" height={175} width={600} />
        </Kb.Box>
      </Kb.Box>
    )
  } else {
    const summary = cachedSummary
    const details = cachedDetails

    let stylesContainer: Kb.Styles.StylesCrossPlatform
    switch (size) {
      case 'Big':
        stylesContainer = styles.containerBig
        break
      case 'Small':
        stylesContainer = styles.containerSmall
        break
    }

    return (
      <Kb.Box style={stylesContainer} onClick={onExpandClick}>
        <Kb.Box style={styles.innerContainer}>
          <Kb.Text center={true} type="BodyBig" style={styles.summary}>
            {summary}
          </Kb.Text>
          <Kb.Button
            label="Please tell us"
            onClick={onFeedback}
            small={true}
            type="Dim"
            style={styles.feedbackButton}
          />
          {summary && (
            <Kb.Icon
              color={Kb.Styles.globalColors.white_75}
              hoverColor={Kb.Styles.globalColors.white}
              onClick={onDismiss}
              style={styles.closeIcon}
              type="iconfont-close"
            />
          )}
        </Kb.Box>
        <Kb.ScrollView>
          <Kb.Text center={true} type="BodyBig" selectable={true} style={styles.details}>
            {details}
          </Kb.Text>
        </Kb.ScrollView>
      </Kb.Box>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => {
  const containerBase = {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 40,
    zIndex: 1000,
    ...Kb.Styles.transition('max-height'),
  } as const

  return {
    closeIcon: {
      position: 'absolute',
      right: Kb.Styles.globalMargins.xsmall,
      top: 10,
    },
    containerBig: Kb.Styles.platformStyles({
      isElectron: {...containerBase, maxHeight: maxHeightForSize('Big')},
    }),
    containerClosed: Kb.Styles.platformStyles({
      isElectron: {...containerBase, maxHeight: maxHeightForSize('Closed')},
    }),
    containerOverlay: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1000,
    },
    containerSmall: Kb.Styles.platformStyles({
      isElectron: {...containerBase, maxHeight: maxHeightForSize('Small')},
    }),
    details: {
      backgroundColor: Kb.Styles.globalColors.black,
      color: Kb.Styles.globalColors.white_75,
      padding: 8,
      paddingLeft: Kb.Styles.globalMargins.xlarge,
      paddingRight: Kb.Styles.globalMargins.xlarge,
    },
    feedbackButton: {
      marginRight: Kb.Styles.globalMargins.large,
    },
    innerContainer: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: Kb.Styles.globalColors.black,
      flex: 1,
      justifyContent: 'center',
      minHeight: maxHeightForSize('Small'),
      padding: Kb.Styles.globalMargins.xtiny,
      position: 'relative',
    },
    message: {
      color: Kb.Styles.globalColors.white,
    },
    overlayFill: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      backgroundColor: Kb.Styles.globalColors.white,
      flex: 1,
      justifyContent: 'center',
    },
    overlayRow: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: Kb.Styles.globalColors.blue,
      justifyContent: 'center',
      padding: 8,
    },
    summary: {
      color: Kb.Styles.globalColors.white,
      flex: 1,
    },
    summaryRow: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: Kb.Styles.globalMargins.xtiny,
      position: 'relative',
    },
    summaryRowError: {
      backgroundColor: Kb.Styles.globalColors.black,
      minHeight: maxHeightForSize('Small'),
    },
  } as const
})

export default GlobalError
