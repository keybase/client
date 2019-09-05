import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props} from '.'

export type Props = {
  timeLeft: string
  onCancelReset: () => void
}

const ResetModal = (props: Props) => {
  return (
    <Kb.ScrollView>
      <Kb.Box2 fullWidth={true} direction="vertical" style={styles.wrapper}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer} alignItems="center">
          <Kb.Text type="Header">Account reset initiated</Kb.Text>
        </Kb.Box2>
        <Kb.Box2
          gap="small"
          direction="vertical"
          fullWidth={true}
          style={styles.textContainer}
          centerChildren={true}
        >
          <Kb.Icon type="iconfont-shh" color={Styles.globalColors.black_20} fontSize={48} />
          <Kb.Text type="Body">This account will reset in {props.timeLeft}.</Kb.Text>
          <Kb.Text type="Body">Explanation goes here.</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonContainer}>
          <Kb.Button
            type="Danger"
            fullWidth={true}
            onClick={props.onCancelReset}
            label="Cancel account reset"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  buttonContainer: {
    padding: Styles.globalMargins.small,
  },
  headerContainer: {
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.small,
  },
  textContainer: {
    ...Styles.globalStyles.flexGrow,
    padding: Styles.globalMargins.small,
  },
  wrapper: Styles.platformStyles({
    isElectron: {
      height: 415,
      width: 360,
    },
  }),
}))

export default Kb.HeaderOrPopupWithHeader(ResetModal)
