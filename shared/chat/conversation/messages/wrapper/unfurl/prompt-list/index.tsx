import * as React from 'react'
import {Box2} from '../../../../../../common-adapters/index'
import Prompt, {Props as PromptProps} from '../prompt'

export type Props = {
  prompts: Array<PromptProps>
}

class UnfurlPromptList extends React.PureComponent<Props> {
  render() {
    return (
      <Box2 direction="vertical" gap="tiny" fullWidth={true}>
        {this.props.prompts.map(p => (
          <Prompt {...p} key={p.domain} />
        ))}
      </Box2>
    )
  }
}

export default UnfurlPromptList
