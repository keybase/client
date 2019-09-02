import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'

const Pin = () => {
  return (
    <Kb.Text type="BodySmall" style={styles.text} selectable={true}>
      pinned a message to this chat.
    </Kb.Text>
  )
}

export default Pin

const styles = Styles.styleSheetCreate({
  text: {flexGrow: 1},
})
