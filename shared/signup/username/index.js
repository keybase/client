// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Header} from '../common'

type Props = {|
  onBack: () => void,
  onChangeUsername: string => void,
  onContinue: () => void,
  onLogin: ?() => void,
  title: string,
|}

const _EnterUsername = (props: Kb.PropsWithOverlay<Props>) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} alignItems="center">
    {!Styles.isMobile && <Header onBack={props.onBack} title="Create an account" />}
    <Kb.Box2 direction="vertical" alignItems="center" style={styles.blueBackground} fullWidth={true}>
      <Kb.Box2
        alignItems="center"
        gap={Styles.isMobile ? 'small' : 'medium'}
        direction="vertical"
        style={styles.body}
        fullWidth={true}
      >
        <Kb.Avatar size={96} />
        <Kb.Box2 direction="vertical" gap="tiny">
          <Kb.NewInput
            autoFocus={true}
            containerStyle={styles.input}
            placeholder="Pick a username"
            onChangeText={props.onChangeUsername}
          />
          <Kb.Text type="BodySmall" style={styles.inputSub}>
            Your username is unique and can not be changed in the future.
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.ButtonBar direction="column" fullWidth={Styles.isMobile} style={styles.buttonBar}>
        <Kb.Button style={styles.button} type="PrimaryGreen" label="Continue" onClick={props.onContinue} />
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.Box2>
)
const EnterUsername = Kb.OverlayParentHOC(_EnterUsername)

const styles = Styles.styleSheetCreate({
  blueBackground: {
    backgroundColor: Styles.globalColors.blueGrey,
    flex: 1,
  },
  body: {
    ...Styles.padding(
      Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xlarge,
      Styles.globalMargins.small
    ),
    flex: 1,
  },
  button: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
    isMobile: {
      width: '100%',
    },
  }),
  buttonBar: Styles.platformStyles({
    isElectron: {
      paddingBottom: Styles.globalMargins.xlarge - Styles.globalMargins.tiny, // tiny added inside buttonbar
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
    },
  }),
  input: Styles.platformStyles({
    common: {},
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xsmall),
      height: 38,
      width: 368,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      height: 48,
    },
  }),
  inputSub: {
    marginLeft: 2,
  },
})

export default (Styles.isMobile ? Kb.HeaderHoc(EnterUsername) : EnterUsername)
