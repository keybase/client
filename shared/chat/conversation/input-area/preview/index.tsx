import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  channelname: string
  onJoinChannel: () => void
  onLeaveChannel: () => void
}

type State = {
  clicked: null | 'join' | 'leave'
}

export default class ChannelPreview extends React.Component<Props, State> {
  state = {clicked: null}
  _onClick = (join: boolean) =>
    this.setState(
      {clicked: join ? 'join' : 'leave'},
      join ? this.props.onJoinChannel : this.props.onLeaveChannel
    )
  render() {
    return (
      <Kb.Box style={styles.container}>
        <Kb.Text type="BodySemibold" negative={true}>
          Would you like to join #{this.props.channelname}?
        </Kb.Text>
        {!this.state.clicked && (
          <Kb.Box2 direction="horizontal" gap="tiny">
            <Kb.Text type="BodySemiboldLink" negative={true} onClick={() => this._onClick(true)}>
              Yes, join
            </Kb.Text>
            <Kb.Text type="BodySemiboldLink" negative={true} onClick={() => this._onClick(false)}>
              No, thanks
            </Kb.Text>
          </Kb.Box2>
        )}
        {!!this.state.clicked && (
          <Kb.Text type="BodySemibold" negative={true}>
            {this.state.clicked === 'join' ? 'Joining...' : 'Leaving...'}
          </Kb.Text>
        )}
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blue,
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
    } as const)
)
