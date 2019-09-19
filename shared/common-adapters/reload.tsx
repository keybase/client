// A screen we show when we have a problem loading a screen
import * as React from 'react'
import * as Styles from '../styles'
import * as Constants from '../constants/waiting'
import {Box2} from './box'
import HeaderHoc from './header-hoc'
import ScrollView from './scroll-view'
import Text from './text'
import Button from './button'
import Icon from './icon'
import {namedConnect} from '../util/container'
import {RPCError} from '../util/errors'

const Kb = {
  Box2,
  Button,
  Icon,
  ScrollView,
  Text,
}

type ReloadProps = {
  onBack?: () => void
  onReload: () => void
  reason: string
  title?: string
}

class Reload extends React.PureComponent<
  ReloadProps,
  {
    expanded: boolean
  }
> {
  state = {expanded: false}
  _toggle = () => this.setState(p => ({expanded: !p.expanded}))
  render() {
    return (
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.reload} gap="small">
        <Icon type="icon-illustration-zen-240-180" />
        <Kb.Text center={true} type="Header">
          We're having a hard time loading this page.
        </Kb.Text>
        {this.state.expanded && (
          <Kb.ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInside}>
            <Kb.Text type="Terminal" style={styles.details}>
              {this.props.reason}
            </Kb.Text>
          </Kb.ScrollView>
        )}
        <Kb.Text type="BodySecondaryLink" onClick={this._toggle}>
          {this.state.expanded ? 'Hide details' : 'Show details'}
        </Kb.Text>

        <Kb.Button label="Retry" mode="Secondary" onClick={this.props.onReload} />
      </Kb.Box2>
    )
  }
}

const ReloadWithHeader = HeaderHoc(Reload)

export type Props = {
  children: React.ReactNode
  needsReload: boolean
  onBack?: () => void
  onReload: () => void
  reason: string
  reloadOnMount?: boolean
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
    return this.props.onBack ? (
      <ReloadWithHeader
        onBack={this.props.onBack}
        onReload={this.props.onReload}
        reason={this.props.reason}
        title={this.props.title}
      />
    ) : (
      <Reload onReload={this.props.onReload} reason={this.props.reason} />
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  details: Styles.platformStyles({
    common: {
      flexGrow: 1,
    },
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  reload: {
    flexGrow: 1,
    maxHeight: '100%',
    maxWidth: '100%',
    padding: Styles.globalMargins.small,
  },
  scroll: Styles.platformStyles({
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
  title?: string
  waitingKeys: string | Array<string>
  errorFilter?: (rPCError: RPCError) => boolean
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  let error = Constants.anyErrors(state, ownProps.waitingKeys)
  if (error && ownProps.errorFilter) {
    error = ownProps.errorFilter(error) ? error : undefined
  }
  return {
    needsReload: !!error,
    reason: (error && error.message) || '',
  }
}
const mapDispatchToProps = () => ({})
const mergeProps = (stateProps, _, ownProps: OwnProps) => ({
  children: ownProps.children,
  needsReload: stateProps.needsReload,
  onBack: ownProps.onBack,
  onReload: ownProps.onReload,
  reason: stateProps.reason,
  reloadOnMount: ownProps.reloadOnMount,
  title: ownProps.title,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Reloadable')(Reloadable)
