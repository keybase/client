import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'
import type * as Types from '../../../../constants/types/chat2'
import ReactButton from '../react-button/container'
import ReactionTooltip from '../reaction-tooltip/container'
import EmojiRow from '../react-button/emoji-row/container'

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

class ReactionsRow extends React.PureComponent<Props, State> {
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

  _newAttachmentRef: typeof ReactButton | null = null
  private _getNewAttachmentRef = () => this._newAttachmentRef
  private _setNewAttachmentRef = (r: typeof ReactButton) => {
    this._newAttachmentRef = r
  }

  render() {
    return this.props.emojis.length === 0 ? null : (
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.container}>
        {this.props.emojis.map(emoji => (
          <Kb.Box
            onMouseOver={() => this._setHoveringButton(true, emoji)}
            onMouseLeave={() => this._setHoveringButton(false, emoji)}
            key={emoji}
          >
            <ReactButton
              ref={(ref: React.Component<any>) => (this._attachmentRefs[emoji] = ref)}
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
          </Kb.Box>
        ))}
        {Styles.isMobile ? (
          <ReactButton
            conversationIDKey={this.props.conversationIDKey}
            ref={this._setNewAttachmentRef as any}
            getAttachmentRef={this._getNewAttachmentRef as any}
            onLongPress={() => this._setShowMobileTooltip(true)}
            ordinal={this.props.ordinal}
            showBorder={true}
            style={styles.button}
          />
        ) : (
          <EmojiRow
            className={Styles.classNames([this.props.btnClassName, this.props.newBtnClassName])}
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
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {marginBottom: Styles.globalMargins.tiny},
      container: {
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        paddingRight: 66,
        paddingTop: Styles.globalMargins.tiny,
      },
      emojiRow: {
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        marginBottom: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
      visibilityHidden: Styles.platformStyles({isElectron: {visibility: 'hidden'}}),
    } as const)
)

export default ReactionsRow
