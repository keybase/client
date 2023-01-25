import * as React from 'react'
import * as Kb from '../../../../../../common-adapters'
import Prompt, {type Props as PromptProps} from './prompt'

export type Props = {
  prompts: Array<PromptProps>
}

const UnfurlPromptList = (p: Props) => {
  const {prompts} = p
  return (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
      {prompts.map(prompt => (
        <Prompt {...prompt} key={prompt.domain} />
      ))}
    </Kb.Box2>
  )
}

export default UnfurlPromptList
