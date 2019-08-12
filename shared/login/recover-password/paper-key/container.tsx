import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import PaperKey from '.'
import {InfoIcon} from '../../../signup/common'

type OwnProps = {}

const ConnectedPaperKey = Container.connect(
  state => ({
    error: state.recoverPassword.paperKeyError.stringValue(),
  }),
  dispatch => ({
    onBack: () => dispatch(RecoverPasswordGen.createAbortPaperKey()),
    onSubmit: (paperKey: string) => dispatch(RecoverPasswordGen.createSubmitPaperKey({paperKey})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(PaperKey)

// @ts-ignore fix this
ConnectedPaperKey.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default ConnectedPaperKey
