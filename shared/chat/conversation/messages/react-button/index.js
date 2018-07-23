// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2, ClickableBox, Emoji, FloatingBox, Icon, Text} from '../../../../common-adapters'
import {
  collapseStyles,
  glamorous,
  globalColors,
  globalMargins,
  isMobile,
  platformStyles,
  styleSheetCreate,
  transition,
} from '../../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../../common-adapters/emoji'

export type Props = {|
  active: boolean,
  conversationIDKey: Types.ConversationIDKey,
  count: number,
  emoji: string,
  onClick: () => void,
  onMouseLeave?: (evt: SyntheticEvent<Element>) => void,
  onMouseOver?: (evt: SyntheticEvent<Element>) => void,
  ordinal: Types.Ordinal,
|}

const ButtonBox = glamorous(ClickableBox)({
  ...(isMobile
    ? {}
    : {
        ':hover': {
          backgroundColor: globalColors.blue4,
          borderColor: globalColors.blue,
        },
      }),
  borderColor: globalColors.black_10,
})
const ReactButton = (props: Props) => (
  <ButtonBox
    onMouseLeave={props.onMouseLeave}
    onMouseOver={props.onMouseOver}
    onClick={props.onClick}
    style={collapseStyles([styles.buttonBox, props.active && styles.active])}
  >
    <Box2 centerChildren={true} direction="horizontal" gap="xtiny" style={styles.container}>
      <Emoji size={14} emojiName={props.emoji} />
      <Text type="BodySmallBold">{props.count}</Text>
    </Box2>
  </ButtonBox>
)

const iconCycle = [
  'iconfont-reacji',
  'iconfont-reacji-wave',
  'iconfont-reacji-heart',
  'iconfont-reacji-sheep',
]
export type NewReactionButtonProps = {|
  onAddReaction: (emoji: string) => void,
  showBorder: boolean,
|}
type NewReactionButtonState = {|
  attachmentRef: ?React.Component<any, any>,
  iconIndex: number,
  showingPicker: boolean,
|}
export class NewReactionButton extends React.Component<NewReactionButtonProps, NewReactionButtonState> {
  state = {attachmentRef: null, iconIndex: 0, showingPicker: false}
  _intervalID: IntervalID

  _setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))

  _onAddReaction = ({colons}: {colons: string}, evt: Event) => {
    evt.stopPropagation()
    this.props.onAddReaction(colons)
    this._setShowingPicker(false)
  }

  _onShowPicker = (evt: SyntheticEvent<Element>) => {
    evt.stopPropagation()
    this._setShowingPicker(true)
  }

  _startCycle = () => {
    this._intervalID = setInterval(this._nextIcon, 1000)
  }

  _stopCycle = () => {
    clearInterval(this._intervalID)
    this.setState(s => (s.iconIndex === 0 ? null : {iconIndex: 0}))
  }

  _nextIcon = () => this.setState(s => ({iconIndex: (s.iconIndex + 1) % iconCycle.length}))

  componentWillUnmount() {
    this._stopCycle()
  }

  render() {
    const ContainerComp = this.props.showBorder ? ButtonBox : ClickableBox
    return (
      <ContainerComp
        onClick={this._onShowPicker}
        onMouseLeave={this._stopCycle}
        onMouseEnter={this._startCycle}
        style={collapseStyles([styles.newReactionButtonBox, this.props.showBorder && styles.buttonBox])}
      >
        <Box2
          ref={attachmentRef => this.setState(s => (s.attachmentRef ? null : {attachmentRef}))}
          centerChildren={true}
          direction="horizontal"
          style={this.props.showBorder ? styles.container : null}
        >
          <Icon type={iconCycle[this.state.iconIndex]} fontSize={isMobile ? 22 : 16} />
        </Box2>
        {this.state.showingPicker && (
          <FloatingBox
            attachTo={this.state.attachmentRef}
            position="bottom left"
            onHidden={() => this._setShowingPicker(false)}
          >
            <Picker
              autoFocus={true}
              emoji="star-struck"
              title="reacjibase"
              onClick={this._onAddReaction}
              backgroundImageFn={backgroundImageFn}
            />
          </FloatingBox>
        )}
      </ContainerComp>
    )
  }
}

const styles = styleSheetCreate({
  active: {
    backgroundColor: globalColors.blue4,
    borderColor: globalColors.blue,
  },
  buttonBox: {
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 2,
    height: 24,
    ...transition('border-color', 'background-color'),
  },
  container: platformStyles({
    common: {
      paddingLeft: globalMargins.xtiny,
      paddingRight: globalMargins.xtiny,
    },
    isElectron: {
      paddingBottom: globalMargins.tiny,
      paddingTop: globalMargins.tiny,
    },
  }),
  newReactionButtonBox: {
    width: 37,
  },
})

export default ReactButton
