import * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  channelname: string
  onJoinChannel: () => void
  onLeaveChannel: () => void
}

type State = {
  clicked: undefined | 'join' | 'leave'
}

export default class ChannelPreview extends React.Component<Props, State> {
  state: State = {clicked: undefined}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blue,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)
