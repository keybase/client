import * as React from 'react'
import {connect, getRouteProps} from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import * as Types from '../../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {RouteProps} from '../../../../../route-tree/render-route'
import {globalColors, globalMargins, styleSheetCreate} from '../../../../../styles'
import EmojiPicker from '.'

type OwnProps = RouteProps<
  {
    conversationIDKey: Types.ConversationIDKey
    ordinal: Types.Ordinal
  },
  {}
>

type WrapperProps = {
  onAddReaction: (emoji: string) => void
  onCancel: () => void
}

type WrapperState = {
  filter: string
  width: number
}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => {
  const conversationIDKey = getRouteProps(ownProps, 'conversationIDKey')
  const ordinal = getRouteProps(ownProps, 'ordinal')
  return {
    onAddReaction: (emoji: string) => {
      dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...dispatchProps,
})

class Wrapper extends React.Component<WrapperProps, WrapperState> {
  state = {filter: '', width: 0}

  _onLayout = evt => {
    if (evt.nativeEvent) {
      const width = evt.nativeEvent.layout.width
      this.setState(s => (s.width !== width ? {width} : null))
    }
  }

  render() {
    return (
      <Kb.Box2
        direction="vertical"
        onLayout={this._onLayout}
        style={styles.alignItemsCenter}
        fullWidth={true}
        fullHeight={true}
      >
        <Kb.NewInput
          autoFocus={true}
          containerStyle={styles.input}
          decoration={
            <Kb.Text type="BodySemiboldLink" onClick={this.props.onCancel}>
              Cancel
            </Kb.Text>
          }
          placeholder="Search"
          icon="iconfont-search"
          onChangeText={filter => this.setState({filter})}
          textType="BodySemibold"
        />
        <EmojiPicker
          filter={this.state.filter}
          onChoose={emoji => this.props.onAddReaction(`:${emoji.short_name}:`)}
          width={this.state.width}
        />
      </Kb.Box2>
    )
  }
}

const styles = styleSheetCreate({
  alignItemsCenter: {
    alignItems: 'center',
  },
  input: {
    borderBottomWidth: 1,
    borderColor: globalColors.black_10,
    borderRadius: 0,
    borderWidth: 0,
    padding: globalMargins.small,
  },
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Wrapper)
