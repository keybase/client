// @flow
import * as React from 'react'
import mentionHoc, {type PropsFromContainer} from '../mention-handler-hoc'
import {default as _Input} from '.'

// For some reason, flow can't infer the type of mentionHoc here.
const MentionHocInput: React.ComponentType<PropsFromContainer> = mentionHoc(_Input)

class Input extends React.Component<PropsFromContainer> {
  render() {
    return <MentionHocInput {...this.props} />
  }
}

export type {PropsFromContainer as Props}

export default Input
