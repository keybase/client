// @flow

import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Props} from './index.types'

const ThreadSearch = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal">
      <Kb.Box2 direction="horizontal" gap="tiny" style={styles.inputContainer}>
        <Kb.Icon
          type="iconfont-search"
          color={Styles.globalColors.black_50}
          fontSize={Styles.isMobile ? 20 : 16}
        />
        <Kb.Input hideUnderline={true} hintText={'Search...'} small={true} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  inputContainer: {
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
  },
})

export default ThreadSearch
