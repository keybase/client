// @flow
import * as React from 'react'
import * as ProfileGen from '../../actions/profile-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'

type OwnProps = {||}
type Props = {|
  fullName: ?string,
  email1: ?string,
  email2: ?string,
  email3: ?string,
  errorText: ?string,
  errorEmail1: boolean,
  errorEmail2: boolean,
  errorEmail3: boolean,
  onChangeFullName: (next: string) => void,
  onChangeEmail1: (next: string) => void,
  onChangeEmail2: (next: string) => void,
  onChangeEmail3: (next: string) => void,
  onCancel: () => void,
  onNext: () => void,
|}

const Info = (props: Props) => {
  const nextDisabled = !props.email1 || !props.fullName || !!props.errorText
  return (
    <Kb.StandardScreen style={styleContainer} onCancel={props.onCancel}>
      {/* TODO(MM) when we get the pgp icon, put it in here */}
      <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" style={styleIcon} />
      <Kb.Text style={styleHeader} type="BodySemibold">
        {' '}
        Fill in your public info.
      </Kb.Text>
      <Kb.Input
        autoFocus={true}
        hintText="Your full name"
        value={props.fullName}
        onChangeText={props.onChangeFullName}
      />
      <Kb.Input
        small={true}
        smallLabel="Email 1:"
        hintText="(required)"
        onChangeText={props.onChangeEmail1}
        value={props.email1}
        errorText={props.errorEmail1 ? 'error' : null}
      />
      <Kb.Input
        small={true}
        smallLabel="Email 2:"
        hintText="(optional)"
        onChangeText={props.onChangeEmail2}
        value={props.email2}
        errorText={props.errorEmail2 ? 'error' : null}
      />
      <Kb.Input
        small={true}
        smallLabel="Email 3:"
        hintText="(optional)"
        onChangeText={props.onChangeEmail3}
        value={props.email3}
        errorText={props.errorEmail3 ? 'error' : null}
      />
      <Kb.Text style={styleInfoMessage(!!props.errorText)} type={props.errorText ? 'BodySmallError' : 'Body'}>
        {props.errorText || 'Include any addresses you plan to use for PGP encrypted email.'}
      </Kb.Text>
      <Kb.Box style={styleActions}>
        <Kb.Button
          type="Secondary"
          label="Cancel"
          onClick={props.onCancel}
          style={{marginRight: Styles.globalMargins.tiny}}
        />
        <Kb.Button type="Primary" label="Let the math begin" disabled={nextDisabled} onClick={props.onNext} />{' '}
      </Kb.Box>
    </Kb.StandardScreen>
  )
}

const styleContainer = {
  alignItems: undefined,
  maxWidth: 460,
  width: '100%',
}

const styleIcon = {
  alignSelf: 'center',
}

const styleHeader = {
  alignSelf: 'center',
  marginTop: Styles.globalMargins.medium,
}

const styleInfoMessage = (errorText: boolean) => ({
  alignSelf: 'center',
  marginTop: Styles.globalMargins.small,
})

const styleActions = {
  ...Styles.globalStyles.flexBoxRow,
  alignSelf: 'center',
  marginTop: Styles.globalMargins.medium,
}

const mapStateToProps = state => ({
  email1: state.profile.pgpEmail1,
  email2: state.profile.pgpEmail2,
  email3: state.profile.pgpEmail3,
  errorEmail1: state.profile.pgpErrorEmail1,
  errorEmail2: state.profile.pgpErrorEmail2,
  errorEmail3: state.profile.pgpErrorEmail3,
  errorText: state.profile.pgpErrorText,
  fullName: state.profile.pgpFullName,
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onChangeEmail1: pgpEmail1 => dispatch(ProfileGen.createUpdatePgpInfo({pgpEmail1})),
  onChangeEmail2: pgpEmail2 => dispatch(ProfileGen.createUpdatePgpInfo({pgpEmail2})),
  onChangeEmail3: pgpEmail3 => dispatch(ProfileGen.createUpdatePgpInfo({pgpEmail3})),
  onChangeFullName: pgpFullName => dispatch(ProfileGen.createUpdatePgpInfo({pgpFullName})),
  onNext: () => dispatch(ProfileGen.createGeneratePgp()),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Info'
)(Info)
