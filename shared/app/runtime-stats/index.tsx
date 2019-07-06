import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  cpu: string
  resident: string
}

const RuntimeStats = (props: Props) => {
  return (
    <Kb.Box2 direction={Styles.isMobile ? 'horizontal' : 'vertical'} style={styles.container} gap="xxtiny">
      <Kb.Text style={styles.stat} type="BodyTiny">{`CPU: ${props.cpu}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`Res: ${props.resident}`}</Kb.Text>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black,
      padding: Styles.globalMargins.xtiny,
    },
  }),
  stat: {
    color: Styles.globalColors.white,
  },
})

export default RuntimeStats
