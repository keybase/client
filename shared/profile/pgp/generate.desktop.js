// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as ProfileGen from '../../actions/profile-gen'
import {namedConnect} from '../../util/container'

type OwnProps = {||}

const Generate = props => (
  <Kb.StandardScreen onCancel={props.onCancel} style={styleContainer}>
    <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" />
    <Kb.Text style={styleHeader} type="Header">
      Generating your unique key...
    </Kb.Text>
    <Kb.Text style={styleBody} type="Body">
      Math time! You are about to discover a 4096-bit key pair.
      <br />
      This could take as long as a couple of minutes.
    </Kb.Text>
    <Kb.Icon type="icon-loader-infinity-64" />
    <Kb.Button style={styleCancelButton} type="Secondary" onClick={props.onCancel} label={'Cancel'} />
  </Kb.StandardScreen>
)

const styleContainer = {
  maxWidth: 512,
}

const styleHeader = {
  marginTop: Styles.globalMargins.medium,
}

const styleBody = {
  marginBottom: Styles.globalMargins.large,
  marginTop: Styles.globalMargins.small,
}

const styleCancelButton = {
  marginTop: Styles.globalMargins.large,
}

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(ProfileGen.createCancelPgpGen()),
})

export default namedConnect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
'Generate'
)(Generate)
