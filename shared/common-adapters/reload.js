// @flow
// A screen we show when we have a problem loading a screen
import * as React from 'react'
import * as Styles from '../styles'
import * as Constants from '../constants/waiting'
import {Box2} from './box'
import Text from './text'
import Button from './button'
import {connect} from '../util/container'
import {isArray} from 'lodash-es'

type OwnProps = {|
  children: React.Node,
  reloadOnMount?: boolean,
  onReload: () => void,
  waitingKeys: string | Array<string>,
|}

type Props = {|
  children: React.Node,
  needsReload: boolean,
  onReload: () => void,
  reason: string,
  reloadOnMount?: boolean,
|}

class Reload extends React.PureComponent<{onReload: () => void, reason: string}, {expanded: boolean}> {
  state = {expanded: false}
  _toggle = () => this.setState(p => ({expanded: !p.expanded}))
  render() {
    return (
      <Box2 direction="vertical" centerChildren={true} style={styles.reload} gap="tiny">
        <Text type="Header">Oops... We're having a hard time loading this page. Try again?</Text>
        <Text type="Body" onClick={this._toggle}>
          {this.state.expanded ? `I'm not exactly sure why I did that` : `I'm curious...`}
        </Text>
        {this.state.expanded && (
          <Text type="Terminal" style={styles.details}>
            {this.props.reason}
          </Text>
        )}
        <Button type="Primary" label="🙏 Retry" onClick={this.props.onReload} />
      </Box2>
    )
  }
}

class Reloadable extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.reloadOnMount && this.props.onReload()
  }

  render() {
    return this.props.needsReload ? (
      <Reload onReload={this.props.onReload} reason={this.props.reason} />
    ) : (
      this.props.children
    )
  }
}

const styles = Styles.styleSheetCreate({
  details: {backgroundColor: Styles.globalColors.darkBlue3, maxWidth: '75%', padding: 60},
  reload: {flexGrow: 1},
})

const mapStateToProps = (state, ownProps: OwnProps) => {
  const keys = isArray(ownProps.waitingKeys) ? ownProps.waitingKeys : [ownProps.waitingKeys]
  const error = Constants.anyErrors(state, ...keys)
  return {
    needsReload: !!error,
    reason: error?.message ?? '',
  }
}
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  children: ownProps.children,
  needsReload: stateProps.needsReload,
  onReload: ownProps.onReload,
  reason: stateProps.reason,
  reloadOnMount: ownProps.reloadOnMount,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Reloadable)
