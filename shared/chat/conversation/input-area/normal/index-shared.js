// @flow
import * as React from 'react'
import mentionHoc, {type PropsFromContainer} from '../mention-handler-hoc'
import Input from '.'

// For some reason, flow can't infer the type of mentionHoc here.
const MentionHocInput: React.ComponentType<PropsFromContainer> = mentionHoc(Input)

export type {PropsFromContainer}

export default MentionHocInput
