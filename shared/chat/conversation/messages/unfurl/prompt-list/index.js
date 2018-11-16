// @flow
import * as React from 'react'
import * as Styles from '../../../../../styles'
import {Box2} from '../../../../../common-adapters/index'
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
    return (
      <Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.container}>
        {prompts}
      </Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      marginLeft: 32 + Styles.globalMargins.tiny + Styles.globalMargins.small,
    },
  }),
})

export default UnfurlPromptList
