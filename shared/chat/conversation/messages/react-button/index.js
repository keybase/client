// @flow
import * as React from 'react'
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

export type Props = {
  active: boolean,
  count: number,
  emoji: string,
  onClick: () => void,
}

const ButtonBox = glamorous(ClickableBox)({
  ...(isMobile
    ? {}
    : {
        ':hover': {
          backgroundColor: globalColors.blue4,
          borderColor: globalColors.blue,
        },
      }),
  borderColor: globalColors.black_05,
})

type State = {
  attachmentRef: ?React.Component<any, any>,
  showingTooltip: boolean,
}
class ReactButton extends React.Component<Props, State> {
  state = {attachmentRef: null, showingTooltip: false}
  /* If this or the tooltip is being hovered, showingTooltip = true */
  _hoveringButton = false
  _hoveringTooltip = false
  _setHoveringButton = hovering => {
    this._hoveringButton = hovering
    this._handleShowingTooltip()
  }
  _setHoveringTooltip = hovering => {
    this._hoveringTooltip = hovering
    this._handleShowingTooltip()
  }
  _handleShowingTooltip = () => {
    const nextShowingTooltip = this._hoveringButton || this._hoveringTooltip
    this.setState(
      s => (s.showingTooltip === nextShowingTooltip ? null : {showingTooltip: nextShowingTooltip})
    )
  }

  render() {
    return (
      <ButtonBox
        onMouseOver={() => this._setHoveringButton(true)}
        onMouseLeave={() => this._setHoveringButton(false)}
        onClick={this.props.onClick}
        style={collapseStyles([styles.buttonBox, this.props.active && styles.active])}
      >
        <Box2 centerChildren={true} direction="horizontal" gap="xtiny" style={styles.container}>
          <Emoji size={14} emojiName={this.props.emoji} />
          <Text type="BodySmallBold">{this.props.count}</Text>
        </Box2>
      </ButtonBox>
    )
  }
}

type NewReactionButtonProps = {
  onAddReaction: (emoji: string) => void,
  showBorder: boolean,
}
type NewReactionButtonState = {
  attachmentRef: ?React.Component<any, any>,
  showingPicker: boolean,
}
export class NewReactionButton extends React.Component<NewReactionButtonProps, NewReactionButtonState> {
  state = {attachmentRef: null, showingPicker: false}
  _hoveringButton = false

  _setHoveringButton = (hovering: boolean) => {
    this._hoveringButton = hovering
  }

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

  render() {
    const ContainerComp = this.props.showBorder ? ButtonBox : ClickableBox
    return (
      <ContainerComp
        onMouseOver={() => this._setHoveringButton(true)}
        onMouseLeave={() => this._setHoveringButton(false)}
        onClick={this._onShowPicker}
        style={collapseStyles([styles.newReactionButtonBox, this.props.showBorder && styles.buttonBox])}
      >
        <Box2
          ref={attachmentRef => this.setState(s => (s.attachmentRef ? null : {attachmentRef}))}
          centerChildren={true}
          direction="horizontal"
          style={this.props.showBorder ? styles.container : null}
        >
          <Icon type="iconfont-reacji" fontSize={isMobile ? 22 : 16} />
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
