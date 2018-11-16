// @flow
import * as React from 'react'
import * as Prompt from '../prompt'
import * as Styles from '../../../../../styles'
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
