import * as C from '@/constants'
// A screen we show when we have a problem loading a screen
import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import BackButton from './back-button'
import ScrollView from './scroll-view'
import Text from './text'
import Button from './button'
import ImageIcon from './image-icon'
import type {RPCError} from '@/util/errors'
import {settingsFeedbackTab} from '@/constants/settings'
import {useConfigState} from '@/stores/config'
import {NavigationContext} from '@react-navigation/core'

const Kb = {
  BackButton,
  Box2,
  Button,
  ImageIcon,
  ScrollView,
  Text,
}

const autoReloadedNavigations = new WeakSet<object>()
const pendingAutoReloadNavigations = new WeakSet<object>()

type ReloadProps = {
  onBack?: (() => void) | undefined
  onFeedback: () => void
  onReload: (isRetry?: boolean) => void
  reason: string
  style?: Styles.StylesCrossPlatform | undefined
  title?: string | undefined
}

function Reload(props: ReloadProps) {
  const [expanded, setExpanded] = React.useState(false)
  const toggle = () => setExpanded(e => !e)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={props.style}>
      {Styles.isMobile && props.onBack && (
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.header}>
          <Kb.BackButton onClick={props.onBack} />
          <Kb.Box2 direction="horizontal" centerChildren={true} flex={1}>
            {props.title && <Kb.Text type="BodyBig">{props.title}</Kb.Text>}
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" style={styles.headerSide} />
        </Kb.Box2>
      )}
      <Kb.ScrollView style={styles.container}>
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          flex={1}
          style={styles.reload}
          gap="small"
          padding="small"
        >
          <Kb.ImageIcon type="icon-illustration-zen-240-180" />
          <Kb.Text center={true} type="Header">
            {"We're having a hard time loading this page."}
          </Kb.Text>
          {expanded && (
            <Kb.Box2 direction="vertical" style={styles.detailContainer}>
              <Kb.Text type="Terminal" style={styles.details}>
                {props.reason}
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Text type="BodySecondaryLink" onClick={toggle}>
            {expanded ? 'Hide details' : 'Show details'}
          </Kb.Text>
          <Kb.Box2 direction="horizontal" gap="tiny">
            <Kb.Button label="Retry" mode="Secondary" onClick={() => props.onReload(true)} />
            <Kb.Button label="Feedback" mode="Primary" onClick={props.onFeedback} />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

export type Props = {
  children: React.ReactNode
  isWaiting: boolean
  needsReload: boolean
  onBack?: (() => void) | undefined
  onFeedback: () => void
  onReload: (isRetry?: boolean) => void
  reason: string
  reloadOnMount?: boolean | undefined
  style?: Styles.StylesCrossPlatform | undefined
  title?: string | undefined
}

const Reloadable = (props: Props) => {
  const {reloadOnMount, onReload, isWaiting} = props
  const navigation = React.useContext(NavigationContext)
  React.useEffect(() => {
    if (!navigation) {
      return
    }
    return navigation.addListener('blur', () => {
      autoReloadedNavigations.delete(navigation)
      pendingAutoReloadNavigations.delete(navigation)
    })
  }, [navigation])
  const maybeAutoReload = React.useEffectEvent(() => {
    if (!navigation || !reloadOnMount || autoReloadedNavigations.has(navigation)) {
      return
    }
    if (isWaiting) {
      pendingAutoReloadNavigations.add(navigation)
      return
    }
    autoReloadedNavigations.add(navigation)
    pendingAutoReloadNavigations.delete(navigation)
    onReload()
  })
  const [stableReload] = React.useState(() => () => {
    maybeAutoReload()
  })
  C.Router2.useSafeFocusEffect(stableReload)
  React.useEffect(() => {
    if (!navigation || isWaiting || !pendingAutoReloadNavigations.has(navigation)) {
      return
    }
    maybeAutoReload()
  }, [isWaiting, navigation])
  if (!props.needsReload) {
    return <>{props.children}</>
  }
  return (
    <Reload
      onBack={props.onBack}
      onFeedback={props.onFeedback}
      onReload={onReload}
      reason={props.reason}
      style={props.style}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        height: '100%',
        width: '100%',
      },
      detailContainer: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueDarker2,
          borderRadius: Styles.borderRadius,
        },
        isElectron: {
          padding: Styles.globalMargins.large,
          width: '75%',
        },
        isMobile: {
          padding: Styles.globalMargins.small,
          width: '100%',
        },
      }),
      details: Styles.platformStyles({
        common: {flexGrow: 1},
        isElectron: {wordBreak: 'break-all'},
      }),
      header: Styles.platformStyles({
        common: {
          borderBottomColor: Styles.globalColors.black_10,
          borderBottomWidth: 1,
          borderStyle: 'solid' as const,
        },
        isAndroid: {height: 56},
        isIOS: {height: 44},
      }),
      headerSide: {width: 44},
      reload: {
        maxHeight: '100%',
        maxWidth: '100%',
      },
    }) as const
)

export type OwnProps = {
  children: React.ReactNode
  onBack?: (() => void) | undefined
  onReload: (isRetry?: boolean) => void
  reloadOnMount?: boolean | undefined
  style?: Styles.StylesCrossPlatform | undefined
  title?: string | undefined
  waitingKeys: string | Array<string>
  errorFilter?: ((rPCError: RPCError) => boolean) | undefined
}

const ReloadContainer = (ownProps: OwnProps) => {
  let error = C.Waiting.useAnyErrors(ownProps.waitingKeys)
  const isWaiting = C.Waiting.useAnyWaiting(ownProps.waitingKeys)

  // make sure reloadable only responds to network-related errors
  error = error && C.isNetworkErr(error.code) ? error : undefined

  if (error && ownProps.errorFilter) {
    error = ownProps.errorFilter(error) ? error : undefined
  }

  const _loggedIn = useConfigState(s => s.loggedIn)

  const stateProps = {
    _loggedIn,
    needsReload: !!error,
    reason: error?.message || '',
  }

  const navigateAppend = C.Router2.navigateAppend
  const switchTab = C.Router2.switchTab
  const _onFeedback = (loggedIn: boolean) => {
    if (loggedIn) {
      switchTab(C.Tabs.settingsTab)
      navigateAppend({name: settingsFeedbackTab, params: {}})
    } else {
      navigateAppend({name: 'feedback', params: {}})
    }
  }

  const props = {
    children: ownProps.children,
    isWaiting,
    needsReload: stateProps.needsReload,
    onBack: ownProps.onBack,
    onFeedback: () => _onFeedback(_loggedIn),
    onReload: ownProps.onReload,
    reason: stateProps.reason,
    reloadOnMount: ownProps.reloadOnMount,
    style: ownProps.style,
    title: ownProps.title,
  }

  return <Reloadable {...props} />
}

export default ReloadContainer
