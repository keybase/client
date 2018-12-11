// @flow
// A screen we show when we have a problem loading a screen
import * as React from 'react'
import * as Styles from '../styles'
import {Box2} from './box'
import Text from './text'
import Button from './button'
import {connect} from '../util/container'

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
  waitingKeys: string | Array<string>,
|}

const Reload = props => (
  <Box2 direction="vertical" centerChildren={true} style={styles.reload} gap="tiny">
    <Text type="Header">Oops... We're having a hard time loading this page. Try again?</Text>
    <Text type="Body">{props.reason}</Text>
    <Button type="Primary" label="🙏 Retry" onClick={props.onReload} />
  </Box2>
)

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
  reload: {flexGrow: 1},
})

const mapStateToProps = (state, ownProps: OwnProps) => ({
  needsReload: true,
  reason: 'black barrrr',
})
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  children: ownProps.children,
  needsReload: stateProps.needsReload,
  onReload: ownProps.onReload,
  reason: stateProps.reason,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Reloadable)
