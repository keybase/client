// @flow
import * as React from 'react'
import * as Prompt from '../prompt'
import {Box2} from '../../../../../common-adapters/index'

export type Props = {
  prompts: Array<Prompt.Props>,
}

class UnfurlPromptList extends React.PureComponent<Props> {
  render() {
    const prompts = []
    for (let p of this.props.prompts) {
      prompts.push(
        <Prompt.default
          key={p.domain}
          domain={p.domain}
          onAlways={p.onAlways}
          onAccept={p.onAccept}
          onNotnow={p.onNotnow}
          onNever={p.onNever}
        />
      )
    }
    return (
      <Box2 direction="vertical" gap="tiny" fullWidth={true}>
        {prompts}
      </Box2>
    )
  }
}

export default UnfurlPromptList
