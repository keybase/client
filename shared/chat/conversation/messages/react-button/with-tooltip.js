// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import ReactButton from './container'
import ReactionTooltip from '../reaction-tooltip/container'
import type {StylesCrossPlatform} from '../../../../styles'

/**
 * This file is split from index.js to avoid a circular dependency
 * between ReactButton and ReactionTooltip, which uses ReactButton.
 * ReactionTooltip's version is the one in index.js, this should be
 * used in contexts when the tooltip should also appear.
 */

// Passthroughs to `WrapperProps` in ./container
// This component adds the mouse handlers
export type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  emoji?: string,
  ordinal: Types.Ordinal,
  showBorder?: boolean,
  style?: StylesCrossPlatform,
|}
type State = {
  attachmentRef: ?React.Component<any, any>,
  showingTooltip: boolean,
}
class ReactButtonWithTooltip extends React.Component<Props, State> {
  static displayName = 'ReactButtonWithTooltip'
  state = {attachmentRef: null, showingTooltip: false}
  /* If this or the tooltip is being hovered, showingTooltip = true */
  _hoveringButton = false
  _hoveringTooltip = false
  _timeoutID: TimeoutID
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
    if (this.state.showingTooltip && !this._hoveringButton && !nextShowingTooltip) {
      // Give the user some time to hop between the button and the tooltip
      this._timeoutID = setTimeout(
        () =>
          this.setState(s => {
            const newNextShowingTooltip = this._hoveringButton || this._hoveringTooltip
            return s.showingTooltip === newNextShowingTooltip ? null : {showingTooltip: newNextShowingTooltip}
          }),
        100
      )
    } else {
      this.setState(
        s => (s.showingTooltip === nextShowingTooltip ? null : {showingTooltip: nextShowingTooltip})
      )
    }
  }
  _setAttachmentRef = attachmentRef => this.setState(s => (s.attachmentRef ? null : {attachmentRef}))

  componentWillUnmount() {
    clearTimeout(this._timeoutID)
  }

  render() {
    return (
      <React.Fragment>
        <ReactButton
          onMouseOver={() => this._setHoveringButton(true)}
          onMouseLeave={() => this._setHoveringButton(false)}
          {...this.props}
          ref={this._setAttachmentRef}
        />
        <ReactionTooltip
          attachmentRef={this.state.attachmentRef}
          conversationIDKey={this.props.conversationIDKey}
          emoji={this.props.emoji || ''}
          onHidden={() => {}}
          onMouseOver={() => this._setHoveringTooltip(true)}
          onMouseLeave={() => this._setHoveringTooltip(false)}
          ordinal={this.props.ordinal}
          visible={this.state.showingTooltip}
        />
      </React.Fragment>
    )
  }
}

export default ReactButtonWithTooltip
