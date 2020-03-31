// A screen we show when we have a problem loading a screen
import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import * as Constants from '../constants/waiting'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {Box2} from './box'
import {HeaderHocHeader} from './header-hoc'
import ScrollView from './scroll-view'
import Text from './text'
import Button from './button'
import Icon from './icon'
import {RPCError} from '../util/errors'
import {settingsTab} from '../constants/tabs'
import {feedbackTab} from '../constants/settings'

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

class Reloadable extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.reloadOnMount && this.props.onReload()
  }

  render() {
    if (!this.props.needsReload) {
      return this.props.children
    }
    return (
      <Reload
        onBack={this.props.onBack}
        onReload={this.props.onReload}
        onFeedback={this.props.onFeedback}
        reason={this.props.reason}
        style={this.props.style}
      />
    )
  }
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

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    let error = Constants.anyErrors(state, ownProps.waitingKeys)

    // make sure reloadable only responds to network-related errors
    error = error && Container.isNetworkErr(error.code) ? error : undefined

    if (error && ownProps.errorFilter) {
      error = ownProps.errorFilter(error) ? error : undefined
    }
    return {
      _loggedIn: state.config.loggedIn,
      needsReload: !!error,
      reason: (error && error.message) || '',
    }
  },
  dispatch => ({
    _onFeedback: (loggedIn: boolean) => {
      if (loggedIn) {
        dispatch(RouteTreeGen.createNavigateAppend({path: [settingsTab]}))
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {heading: 'Oh no, a bug!'}, selected: feedbackTab}],
          })
        )
      } else {
        dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
      }
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    children: ownProps.children,
    needsReload: stateProps.needsReload,
    onBack: ownProps.onBack,
    onFeedback: () => dispatchProps._onFeedback(stateProps._loggedIn),
    onReload: ownProps.onReload,
    reason: stateProps.reason,
    reloadOnMount: ownProps.reloadOnMount,
    style: ownProps.style,
    title: ownProps.title,
  }),

  'Reloadable'
)(Reloadable)
