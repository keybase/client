import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Box2} from '../../../../common-adapters'
import ReactButton from '../react-button/container'
import ReactionTooltip from '../reaction-tooltip/container'
import EmojiRow from '../react-button/emoji-row/container'
import {
  borderRadius,
  classNames,
  globalColors,
  globalMargins,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../../styles'

export type Props = {
  btnClassName?: string
  newBtnClassName?: string
  conversationIDKey: Types.ConversationIDKey
  emojis: Array<string>
  ordinal: Types.Ordinal
}

type State = {
  activeEmoji: string
  showMobileTooltip: boolean
}

class ReactionsRow extends React.Component<Props, State> {
  state = {
    activeEmoji: '',
    showMobileTooltip: false,
  }
  _attachmentRefs: {[K in string]: React.Component<any> | null} = {}

  _setHoveringButton = (hovering: boolean, emojiName: string) => {
    this._setActiveEmoji(hovering ? emojiName : '')
  }

  _setActiveEmoji = (emojiName: string) =>
    this.setState(s => (s.activeEmoji === emojiName ? null : {activeEmoji: emojiName}))

  _setShowMobileTooltip = (showMobileTooltip: boolean) =>
    this.setState(s => (s.showMobileTooltip === showMobileTooltip ? null : {showMobileTooltip}))

  _newAttachmentRef: any = null
  _getNewAttachmentRef = () => this._newAttachmentRef
  _setNewAttachmentRef = r => (this._newAttachmentRef = r)

  render() {
    return this.props.emojis.length === 0 ? null : (
      <Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.container}>
        {this.props.emojis.map(emoji => (
          <Box
            onMouseOver={() => this._setHoveringButton(true, emoji)}
            onMouseLeave={() => this._setHoveringButton(false, emoji)}
            key={emoji}
          >
            <ReactButton
              ref={ref => (this._attachmentRefs[emoji] = ref)}
              className={this.props.btnClassName}
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
        {isMobile ? (
          <ReactButton
            conversationIDKey={this.props.conversationIDKey}
            ref={this._setNewAttachmentRef}
            getAttachmentRef={this._getNewAttachmentRef}
            onLongPress={() => this._setShowMobileTooltip(true)}
            ordinal={this.props.ordinal}
            showBorder={true}
            style={styles.button}
          />
        ) : (
          <EmojiRow
            className={classNames([this.props.btnClassName, this.props.newBtnClassName])}
            conversationIDKey={this.props.conversationIDKey}
            ordinal={this.props.ordinal}
            style={styles.emojiRow}
          />
        )}
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
    paddingRight: 66,
    paddingTop: globalMargins.tiny,
  },
  emojiRow: {
    backgroundColor: globalColors.white,
    borderColor: globalColors.black_10,
    borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginBottom: globalMargins.tiny,
    paddingRight: globalMargins.xtiny,
  },
  visibilityHidden: platformStyles({isElectron: {visibility: 'hidden'}}),
})

export default ReactionsRow
