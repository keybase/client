// @flow
// A screen we show when we have a problem loading a screen
import * as React from 'react'
import * as Styles from '../styles'
import * as Constants from '../constants/waiting'
import {Box2} from './box'
import HeaderHoc from './header-hoc'
import ScrollView from './scroll-view'
import Text from './text'
import Button from './button'
import {namedConnect} from '../util/container'

type ReloadProps = {|
  onBack?: () => void,
  onReload: () => void,
  reason: string,
|}

class _Reload extends React.PureComponent<ReloadProps, {expanded: boolean}> {
  state = {expanded: false}
  _toggle = () => this.setState(p => ({expanded: !p.expanded}))
  render() {
    return (
      <Box2 direction="vertical" centerChildren={true} style={styles.reload} gap="tiny">
        <Text center={true} type="Header">
          Oops... We're having a hard time loading this page. Try again?
        </Text>
        <Text type="Body" onClick={this._toggle}>
          {this.state.expanded ? "I'm not exactly sure why I did that" : "I'm curious..."}
        </Text>
        {this.state.expanded && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInside}>
            <Text type="Terminal" style={styles.details}>
              {this.props.reason}
            </Text>
          </ScrollView>
        )}
        <Button type="Primary" label="🙏 Retry" onClick={this.props.onReload} />
      </Box2>
    )
  }
}

const Reload = HeaderHoc(_Reload)

type Props = {|
  children: React.Node,
  needsReload: boolean,
  onBack?: () => void,
  onReload: () => void,
  reason: string,
  reloadOnMount?: boolean,
|}

class Reloadable extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.reloadOnMount && this.props.onReload()
  }

  render() {
    return this.props.needsReload ? (
      <Reload onBack={this.props.onBack} onReload={this.props.onReload} reason={this.props.reason} />
    ) : (
      this.props.children
    )
  }
}

const styles = Styles.styleSheetCreate({
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
      backgroundColor: Styles.globalColors.darkBlue3,
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
})

type OwnProps = {|
  children: React.Node,
  onBack?: () => void,
  onReload: () => void,
  reloadOnMount?: boolean,
  waitingKeys: string | Array<string>,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const error = Constants.anyErrors(state, ownProps.waitingKeys)
  return {
    needsReload: !!error,
    reason: error?.message ?? '',
  }
}
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  children: ownProps.children,
  needsReload: stateProps.needsReload,
  onBack: ownProps.onBack,
  onReload: ownProps.onReload,
  reason: stateProps.reason,
  reloadOnMount: ownProps.reloadOnMount,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Reloadable'
)(Reloadable)
