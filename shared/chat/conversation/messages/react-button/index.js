// @flow
import * as React from 'react'
import {Box2, ClickableBox, Emoji, Icon, Text} from '../../../../common-adapters'
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
import Rollout from './rollout'

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

const ReactButton = (props: Props) => (
  <ButtonBox
    onClick={props.onClick}
    style={collapseStyles([styles.buttonBox, props.active && styles.active])}
  >
    <Box2 centerChildren={true} direction="horizontal" gap="xtiny" style={styles.container}>
      <Emoji size={14} emojiName={props.emoji} />
      <Text type="BodySmallBold">{props.count}</Text>
    </Box2>
  </ButtonBox>
)

type NewReactionButtonProps = {
  onAddReaction: (emoji: string) => void,
  showBorder: boolean,
}
type NewReactionButtonState = {
  attachmentRef: ?React.Component<any, any>,
  rolledOut: boolean,
}
export class NewReactionButton extends React.Component<NewReactionButtonProps, NewReactionButtonState> {
  state = {attachmentRef: null, rolledOut: false}
  // If this _or_ the rollout is being hovered, we are rolled out
  // I've seen mixed behavior with this not working if we don't also
  // track the hover state of the rollout, so keeping this here to be safe
  _hoveringButton = false
  _hoveringRollout = false

  _setHoveringButton = (hovering: boolean) => {
    this._hoveringButton = hovering
    this._handleRolledOut()
  }

  _setHoveringRollout = (hovering: boolean) => {
    this._hoveringRollout = hovering
    this._handleRolledOut()
  }

  _handleRolledOut = () => {
    const nextRolledOut = this._hoveringButton || this._hoveringRollout
    this.setState(s => (s.rolledOut === nextRolledOut ? null : {rolledOut: nextRolledOut}))
  }

  _onAddReaction = (emojiName: string) => {
    this._setHoveringButton(false)
    this._setHoveringRollout(false)
    this.props.onAddReaction(emojiName)
  }

  render() {
    const ContainerComp = this.props.showBorder ? ButtonBox : ClickableBox
    return (
      <ContainerComp
        onMouseOver={() => this._setHoveringButton(true)}
        onMouseLeave={() => this._setHoveringButton(false)}
        onClick={() => this._onAddReaction(':grinning_face_with_star_eyes:')}
        style={collapseStyles([styles.newReactionButtonBox, this.props.showBorder && styles.buttonBox])}
      >
        <Box2
          ref={r => this.setState(s => (s.attachmentRef ? null : {attachmentRef: r}))}
          centerChildren={true}
          direction="horizontal"
          style={this.props.showBorder ? styles.container : null}
        >
          <Icon type="iconfont-reacji" fontSize={isMobile ? 22 : 16} />
        </Box2>
        <Rollout
          attachTo={this.state.attachmentRef}
          onAddReaction={this._onAddReaction}
          onMouseEnter={() => this._setHoveringRollout(true)}
          onMouseLeave={() => this._setHoveringRollout(false)}
          visible={this.state.rolledOut}
        />
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
