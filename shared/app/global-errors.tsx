import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import logger from '@/logger'
import {ignoreDisconnectOverlay} from '@/local-debug'
import {useConfigState} from '@/stores/config'
import type {RPCError} from '@/util/errors'
import {settingsFeedbackTab} from '@/constants/settings'
import {useDaemonState} from '@/stores/daemon'

type Size = 'Closed' | 'Small' | 'Big'

const summaryForError = (err?: Error | RPCError) => err?.message ?? ''
const detailsForError = (err?: Error | RPCError) => err?.stack ?? ''

const maxHeightForSize = (size: Size) => {
  return {
    Big: 900,
    Closed: 0,
    Small: 35,
  }[size]
}

const useData = () => {
  const loggedIn = useConfigState(s => s.loggedIn)
  const daemonError = useDaemonState(s => s.error)
  const error = useConfigState(s => s.globalError)
  const setGlobalError = useConfigState(s => s.dispatch.setGlobalError)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = React.useCallback(() => {
    setGlobalError()
    if (loggedIn) {
      clearModals()
      navigateAppend(settingsFeedbackTab)
    } else {
      navigateAppend('feedback')
    }
  }, [navigateAppend, clearModals, loggedIn, setGlobalError])
  const onDismiss = React.useCallback(() => {
    setGlobalError()
  }, [setGlobalError])

  const [cachedSummary, setSummary] = React.useState(summaryForError(error))
  const [cachedDetails, setDetails] = React.useState(detailsForError(error))
  const [size, setSize] = React.useState<Size>('Closed')
  const countdownTimerRef = React.useRef<undefined | ReturnType<typeof setTimeout>>(undefined)

  const clearCountdown = React.useCallback(() => {
    countdownTimerRef.current && clearTimeout(countdownTimerRef.current)
    countdownTimerRef.current = undefined
  }, [countdownTimerRef])

  const onExpandClick = React.useCallback(() => {
    setSize('Big')
    if (!C.isMobile) {
      clearCountdown()
    }
  }, [clearCountdown])

  const resetError = React.useCallback(
    (newError: boolean) => {
      setSize(newError ? 'Small' : 'Closed')
      if (!C.isMobile) {
        clearCountdown()
        if (newError) {
          countdownTimerRef.current = setTimeout(() => {
            onDismiss()
          }, 10000)
        }
      }
    },
    [clearCountdown, onDismiss]
  )

  C.useOnUnMountOnce(() => {
    clearCountdown()
  })

  C.useOnMountOnce(() => {
    resetError(!!error)
  })

  React.useEffect(() => {
    const id = setTimeout(
      () => {
        setDetails(detailsForError(error))
        if (!C.isMobile) {
          setSummary(summaryForError(error))
        }
      },
      error ? 0 : 7000
    ) // if it's set, do it immediately, if it's cleared set it in a bit
    resetError(!!error)
    return () => {
      clearTimeout(id)
    }
  }, [error, resetError])

  return {
    cachedDetails,
    cachedSummary,
    daemonError,
    error,
    onDismiss,
    onExpandClick,
    onFeedback,
    size,
  }
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
    if (C.isMobile) {
      return null
    }
    if (ignoreDisconnectOverlay) {
      logger.warn('Ignoring disconnect overlay')
      return null
    }

    const message = daemonError.message || 'Keybase is currently unreachable. Trying to reconnect you…'
    return (
      <Kb.Box2 direction="vertical" style={styles.containerOverlay}>
        <Kb.Box2 direction="horizontal" style={styles.overlayRow}>
          <Kb.Text center={true} type="BodySmallSemibold" style={styles.message}>
            {message}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.overlayFill}>
          <Kb.Animation animationType="disconnected" height={175} width={600} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  if (C.isMobile) {
    return (
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([
          styles.mobileContainer,
          size === 'Big' && Kb.Styles.globalStyles.fillAbsolute,
        ])}
      >
        <Kb.SafeAreaViewTop style={styles.mobileSafeAreaView} />
        <Kb.Box2 direction="vertical">
          <Kb.Box2
            direction="horizontal"
            style={Kb.Styles.collapseStyles([styles.mobileSummaryRow, styles.mobileErrorTextContainer])}
          >
            <Kb.Text
              center={true}
              type="BodySmallSemibold"
              style={styles.mobileErrorText}
              onClick={onExpandClick}
            >
              {size !== 'Big' && (
                <Kb.Icon
                  type="iconfont-caret-right"
                  color={Kb.Styles.globalColors.white_75}
                  sizeType="Tiny"
                />
              )}
              {'  '}
              An error occurred.
            </Kb.Text>
            <Kb.Icon
              type="iconfont-close"
              onClick={onDismiss}
              color={Kb.Styles.globalColors.white_75}
              fontSize={21}
            />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" style={styles.mobileSummaryRow}>
            <Kb.Button fullWidth={true} label="Please tell us" onClick={onFeedback} small={true} type="Dim" />
          </Kb.Box2>
        </Kb.Box2>
        {size === 'Big' && (
          <Kb.ScrollView>
            <Kb.Text type="BodySmall" selectable={true} style={styles.mobileDetails}>
              {error?.message}
              {'\n\n'}
              {cachedDetails}
            </Kb.Text>
          </Kb.ScrollView>
        )}
      </Kb.Box2>
    )
  }

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
    <Kb.ClickableBox style={stylesContainer} onClick={onExpandClick}>
      <Kb.Box2 direction="horizontal" style={styles.innerContainer}>
        <Kb.Text center={true} type="BodyBig" style={styles.summary}>
          {summary}
        </Kb.Text>
        <Kb.Button
          label="Please tell us"
          onClick={onFeedback}
          small={true}
          type="Dim"

        />
        {summary && (
          <Kb.Icon
            color={Kb.Styles.globalColors.white_75}
            hoverColor={Kb.Styles.globalColors.white}
            onClick={onDismiss}
            type="iconfont-close"
          />
        )}
      </Kb.Box2>
      <Kb.ScrollView>
        <Kb.Text center={true} type="BodyBig" selectable={true} style={styles.details}>
          {details}
        </Kb.Text>
      </Kb.ScrollView>
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => {
  const containerBase = {
    left: 0,
    overflow: 'hidden' as const,
    position: 'absolute' as const,
    right: 0,
    top: 40,
    zIndex: 1000,
    ...Kb.Styles.transition('max-height'),
  }

  return {
    containerBig: Kb.Styles.platformStyles({
      isElectron: {...containerBase, maxHeight: maxHeightForSize('Big')},
    }),
    containerOverlay: {
      ...Kb.Styles.globalStyles.fillAbsolute,
      zIndex: 1000,
    },
    containerSmall: Kb.Styles.platformStyles({
      isElectron: {...containerBase, maxHeight: maxHeightForSize('Small')},
    }),
    details: {
      backgroundColor: Kb.Styles.globalColors.black,
      color: Kb.Styles.globalColors.white_75,
      ...Kb.Styles.padding(8, Kb.Styles.globalMargins.xlarge),
    },
    innerContainer: {
      ...Kb.Styles.globalStyles.flexBoxCenter,
      backgroundColor: Kb.Styles.globalColors.black,
      flex: 1,
      gap: Kb.Styles.globalMargins.small,
      minHeight: maxHeightForSize('Small'),
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.small),
    },
    message: {
      color: Kb.Styles.globalColors.white,
    },
    mobileContainer: {
      backgroundColor: Kb.Styles.globalColors.black,
      position: 'absolute',
      top: 0,
    },
    mobileDetails: {
      color: Kb.Styles.globalColors.white_75,
      fontSize: 14,
      lineHeight: 19,
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.xtiny),
    },
    mobileErrorText: {
      color: Kb.Styles.globalColors.white,
      flex: 1,
    },
    mobileErrorTextContainer: {
      paddingBottom: Kb.Styles.globalMargins.xtiny,
      position: 'relative',
    },
    mobileSafeAreaView: {
      backgroundColor: Kb.Styles.globalColors.transparent,
      flexGrow: 0,
    },
    mobileSummaryRow: {
      alignItems: 'center',
      flexShrink: 0,
      justifyContent: 'center',
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
    },
    overlayFill: {
      ...Kb.Styles.globalStyles.flexBoxCenter,
      backgroundColor: Kb.Styles.globalColors.white,
      flex: 1,
    },
    overlayRow: {
      ...Kb.Styles.globalStyles.flexBoxCenter,
      backgroundColor: Kb.Styles.globalColors.blue,
      padding: 8,
    },
    summary: {
      color: Kb.Styles.globalColors.white,
      flex: 1,
    },
  } as const
})

export default GlobalError
