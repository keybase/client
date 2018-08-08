// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  onChangeAddress?: string => void,
  incorrect?: boolean,
  username?: string,
  fullname?: string,
  onShowProfile?: string => void,
}

const Participants = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Text type="BodySmall" style={styles.text}>
        To:
      </Kb.Text>
    {!!props.username && (
      <Kb.NameWithIcon colorFollowing={true} horizontal={true} username={props.username} metaOne={props.fullname} onClick={props.onShowProfile}/>
    )}
    {!props.username && (
      <Kb.Box2 direction="vertical" fullWidh={true} style={styles.inputBox}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.Icon
            type={props.incorrect ? 'iconfont-stellar-request' : 'iconfont-stellar-request'}
            style={Kb.iconCastPlatformStyles(styles.icon)}
          />
          <Kb.NewInput
            type="text"
            onChangeText={props.onChangeAddress}
            textType="BodySemibold"
            placeholder="Stellar address"
            placeholderColor={Styles.globalColors.grey}
            hideBorder={true}
            style={styles.input}
            multiline={true}
          />
        </Kb.Box2>
        {props.incorrect && (
            <Kb.Text type="BodySmall" style={styles.error}>
              This Stellar address is incorrect
            </Kb.Text>
        )}
      </Kb.Box2>
    )}
    </Kb.Box2>
    {props.incorrect && (
      <Kb.Box style={styles.redline} />
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  text: {
    color: Styles.globalColors.blue,
    marginRight: Styles.globalMargins.xsmall,
    marginTop: Styles.globalMargins.xtiny,
    alignSelf: 'flex-start',
  },
  container: {
    margin: Styles.globalMargins.xsmall,
    alignItems: 'flex-start',
  },
  error: Styles.platformStyles({
    common: {
      color: Styles.globalColors.red,
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
  inputBox: {flexGrow: 1},
  // NewInput with icon hangs over the edge at 100%
  input: {width: '90%'},
  redline: {
    backgroundColor: Styles.globalColors.red,
    height: 1,
    width: '100%'
  },
})

export default Participants
