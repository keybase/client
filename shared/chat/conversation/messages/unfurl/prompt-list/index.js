// @flow
import * as React from 'react'
import Prompt from '../prompt'
import type {Props as PromptProps} from '../prompt'

export type Props = {
  prompts: Array<PromptProps>,
}

class UnfurlPromptList extends React.PureComponent<Props> {
  render() {
    const prompts = []
    for (let p of this.props.prompts) {
      prompts.push(
        <Prompt
          key={p.domain}
          domain={p.domain}
          onAlways={p.onAlways}
          onAccept={p.onAccept}
          onNotnow={p.onNotnow}
          onNever={p.onNever}
        />
      )
    }
    return <React.Fragment>{prompts}</React.Fragment>
  }
}

export default UnfurlPromptList
