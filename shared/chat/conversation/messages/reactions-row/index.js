// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Box2} from '../../../../common-adapters'
import ReactButton from '../react-button/container'
import ReactionTooltip from '../reaction-tooltip/container'
import {collapseStyles, globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../../../styles'

export type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  emojis: Array<string>,
  ordinal: Types.Ordinal,
|}
type State = {
  activeEmoji: string,
  showAddReaction: boolean,
  showMobileTooltip: boolean,
}
class ReactionsRow extends React.Component<Props, State> {
  state = {
    activeEmoji: '',
    showAddReaction: false,
    showMobileTooltip: false,
  }
  _attachmentRefs: {[emojiName: string]: ?React.ElementRef<typeof ReactButton>} = {}

  _setHoveringButton = (hovering: boolean, emojiName: string) => {
    this._setActiveEmoji(hovering ? emojiName : '')
  }

  _setActiveEmoji = (emojiName: string) =>
    this.setState(s => (s.activeEmoji === emojiName ? null : {activeEmoji: emojiName}))

  _setHoveringRow = (hovering: boolean) =>
    this.setState(s => (s.showAddReaction === hovering ? null : {showAddReaction: hovering}))

  _setShowMobileTooltip = (showMobileTooltip: boolean) =>
    this.setState(s => (s.showMobileTooltip === showMobileTooltip ? null : {showMobileTooltip}))

  render() {
    return this.props.emojis.length === 0 ? null : (
      <Box2
        onMouseOver={() => this._setHoveringRow(true)}
        onMouseLeave={() => this._setHoveringRow(false)}
        direction="horizontal"
        gap="xtiny"
        fullWidth={true}
        style={styles.container}
      >
        {this.props.emojis.map(emoji => (
          <Box
            onMouseOver={() => this._setHoveringButton(true, emoji)}
            onMouseLeave={() => this._setHoveringButton(false, emoji)}
            key={emoji}
          >
            <ReactButton
              ref={ref => (this._attachmentRefs[emoji] = ref)}
              conversationIDKey={this.props.conversationIDKey}
              emoji={emoji}
              onLongPress={() => this._setShowMobileTooltip(true)}
              ordinal={this.props.ordinal}
              style={styles.button}
            />
            <ReactionTooltip
              attachmentRef={() => this._attachmentRefs[emoji]}
              conversationIDKey={this.props.conversationIDKey}
              emoji={emoji}
              onHidden={() => {}}
              ordinal={this.props.ordinal}
              visible={this.state.activeEmoji === emoji}
            />
          </Box>
        ))}
        <ReactButton
          conversationIDKey={this.props.conversationIDKey}
          onLongPress={() => this._setShowMobileTooltip(true)}
          ordinal={this.props.ordinal}
          showBorder={true}
          style={collapseStyles([
            styles.button,
            // Important to the animation for this to be `visibility: hidden`
            !this.state.showAddReaction && !isMobile && styles.visibilityHidden,
          ])}
        />
        <ReactionTooltip
          conversationIDKey={this.props.conversationIDKey}
          onHidden={() => this._setShowMobileTooltip(false)}
          ordinal={this.props.ordinal}
          visible={this.state.showMobileTooltip}
        />
      </Box2>
    )
  }
}

const styles = styleSheetCreate({
  button: {marginBottom: globalMargins.tiny},
  container: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    // refer to `WrapperAuthor` styles
    marginLeft: 32 + globalMargins.tiny + (isMobile ? globalMargins.tiny : globalMargins.small),
    paddingRight: 66,
  },
  visibilityHidden: platformStyles({isElectron: {visibility: 'hidden'}}),
})

export default ReactionsRow
