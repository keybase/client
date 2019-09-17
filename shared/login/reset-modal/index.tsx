import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props} from '.'

export type Props = {
  mapURL: string
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
          <Kb.Icon type="iconfont-skull" color={Styles.globalColors.black_20} fontSize={48} />
          <Kb.Text type="Body">This account will reset in {props.timeLeft}.</Kb.Text>
          <Kb.Text type="Body">Explanation goes here.</Kb.Text>
          <Kb.Text type="Body">The reset was triggered by the following device:</Kb.Text>
          <Kb.Box2 direction="horizontal" gap="small" fullWidth={true} style={styles.deviceContainer}>
            <Kb.Image src={props.mapURL} style={{height: 100, width: 100}} />
            <Kb.Box2 direction="vertical">
              <Kb.Text type="BodySmallExtrabold">iPhone in New York, NY, US</Kb.Text>
              <Kb.Text type="BodySmall">Verified using the password</Kb.Text>
              <Kb.Text type="BodySmall">Entered on August 8, 2019</Kb.Text>
              <Kb.Text type="BodySmall">IP address: 127.0.0.1</Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
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
  deviceContainer: {},
  headerContainer: {
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.small,
  },
  textContainer: {
    ...Styles.globalStyles.flexGrow,
    padding: Styles.globalMargins.small,
    paddingBottom: 0,
  },
  wrapper: Styles.platformStyles({
    isElectron: {
      height: 415,
      width: 360,
    },
  }),
}))

export default Kb.HeaderOrPopupWithHeader(ResetModal)
