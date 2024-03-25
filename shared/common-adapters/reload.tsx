import * as C from '@/constants'
// A screen we show when we have a problem loading a screen
import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import {HeaderHocHeader} from './header-hoc'
import ScrollView from './scroll-view'
import Text from './text'
import Button from './button'
import Icon from './icon'
import type {RPCError} from '@/util/errors'

const Kb = {
  Box2,
  Button,
  HeaderHocHeader,
  Icon,
  ScrollView,
  Text,
}

type ReloadProps = {
  onBack?: () => void
  onFeedback: () => void
  onReload: () => void
  reason: string
  style?: Styles.StylesCrossPlatform
  title?: string
}

class Reload extends React.PureComponent<ReloadProps, {expanded: boolean}> {
  state = {expanded: false}
  _toggle = () => this.setState(p => ({expanded: !p.expanded}))
  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={this.props.style}>
        {Styles.isMobile && this.props.onBack && (
          <Kb.HeaderHocHeader onBack={this.props.onBack} title={this.props.title} />
        )}
        <Kb.ScrollView style={styles.container}>
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.reload} gap="small">
            <Kb.Icon type="icon-illustration-zen-240-180" />
            <Kb.Text center={true} type="Header">
              We're having a hard time loading this page.
            </Kb.Text>
            {this.state.expanded && (
              <Kb.Box2 direction="vertical" style={styles.detailContainer}>
                <Kb.Text type="Terminal" style={styles.details}>
                  {this.props.reason}
                </Kb.Text>
              </Kb.Box2>
            )}
            <Kb.Text type="BodySecondaryLink" onClick={this._toggle}>
              {this.state.expanded ? 'Hide details' : 'Show details'}
            </Kb.Text>
            <Kb.Box2 direction="horizontal" gap="tiny">
              <Kb.Button label="Retry" mode="Secondary" onClick={this.props.onReload} />
              <Kb.Button label="Feedback" mode="Primary" onClick={this.props.onFeedback} />
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    )
  }
}

export type Props = {
  children: React.ReactNode
  needsReload: boolean
  onBack?: () => void
  onReload: () => void
  onFeedback: () => void
  reason: string
  reloadOnMount?: boolean
  style?: Styles.StylesCrossPlatform
  title?: string
}

const Reloadable = (props: Props) => {
  const {reloadOnMount, onReload} = props

  const onReloadRef = React.useRef(onReload)
  onReloadRef.current = onReload

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      reloadOnMount && onReloadRef.current()
    }, [reloadOnMount])
  )
  if (!props.needsReload) {
    return <>{props.children}</>
  }
  return (
    <Reload
      onBack={props.onBack}
      onReload={props.onReload}
      onFeedback={props.onFeedback}
      reason={props.reason}
      style={props.style}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
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
  reload: {
    flexGrow: 1,
    maxHeight: '100%',
    maxWidth: '100%',
    padding: Styles.globalMargins.small,
  },
  scrollInside: {
    height: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    width: '100%',
  },
}))

export type OwnProps = {
  children: React.ReactNode
  onBack?: () => void
  onReload: () => void
  reloadOnMount?: boolean
  style?: Styles.StylesCrossPlatform
  title?: string
  waitingKeys: string | Array<string>
  errorFilter?: (rPCError: RPCError) => boolean
}

const ReloadContainer = (ownProps: OwnProps) => {
  let error = C.Waiting.useAnyErrors(ownProps.waitingKeys)

  // make sure reloadable only responds to network-related errors
  error = error && C.isNetworkErr(error.code) ? error : undefined

  if (error && ownProps.errorFilter) {
    error = ownProps.errorFilter(error) ? error : undefined
  }

  const _loggedIn = C.useConfigState(s => s.loggedIn)

  const stateProps = {
    _loggedIn,
    needsReload: !!error,
    reason: error?.message || '',
  }

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onFeedback = (loggedIn: boolean) => {
    if (loggedIn) {
      navigateAppend(C.Tabs.settingsTab)
      navigateAppend(C.Settings.settingsFeedbackTab)
    } else {
      navigateAppend('feedback')
    }
  }

  const props = {
    children: ownProps.children,
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
