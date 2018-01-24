// @flow
import * as React from 'react'
import {type Props} from '.'
import {type PropsFromContainer} from './mention-handler-hoc'

type MentionHocState = {
  pickSelectedCounter: number,
  mentionFilter: string,
  channelMentionFilter: string,
  mentionPopupOpen: boolean,
  channelMentionPopupOpen: boolean,
}

const mentionHoc = (InputComponent: React.ComponentType<Props>) => {
  class MentionHoc extends React.Component<PropsFromContainer, MentionHocState> {
    state: MentionHocState
    _inputRef: ?any
    constructor() {
      super()
      this.state = {
        pickSelectedCounter: 0,
        mentionFilter: '',
        channelMentionFilter: '',
        mentionPopupOpen: false,
        channelMentionPopupOpen: false,
      }
    }

    inputSetRef = (input: any) => {
      this.props._inputSetRef(input)
      this._inputRef = input
    }

    setMentionPopupOpen = (mentionPopupOpen: boolean) => this.setState({mentionPopupOpen})
    setChannelMentionPopupOpen = (channelMentionPopupOpen: boolean) =>
      this.setState({channelMentionPopupOpen})

    _triggerPickSelectedCounter = () =>
      this.setState(({pickSelectedCounter}) => ({pickSelectedCounter: pickSelectedCounter + 1}))

    onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
      e.preventDefault()
      if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
        this._triggerPickSelectedCounter()
      }
    }

    onChangeText = (nextText: string) => {}

    insertMention = (u: string) => {}

    insertChannelMention = (c: string) => {}

    render = () => (
      <InputComponent
        {...this.props}
        {...this.state}
        insertChannelMention={this.insertChannelMention}
        insertMention={this.insertMention}
        setMentionPopupOpen={this.setMentionPopupOpen}
        setChannelMentionPopupOpen={this.setChannelMentionPopupOpen}
        onEnterKeyDown={this.onEnterKeyDown}
      />
    )
  }

  return MentionHoc
}

export default mentionHoc
