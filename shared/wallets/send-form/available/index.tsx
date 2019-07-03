import * as React from 'react'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'

export type Props = {
  amountErrMsg: string
}

const Available = (props: Props) => {
  // This will only work to apply one custom style.
  const splitText = props.amountErrMsg.split('*')
  if (splitText.length === 0) {
    return null
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text type="BodySmall" style={styles.text}>
        {splitText.map((t, idx) => (
          <Kb.Text
            selectable={true}
            key={idx}
            type={idx % 2 === 0 ? 'BodySmallError' : 'BodySmallExtrabold'}
            style={styles.text}
          >
            {t}
          </Kb.Text>
        ))}
      </Kb.Text>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  text: {
    color: Styles.globalColors.redDark,
  },
})

export default Available
