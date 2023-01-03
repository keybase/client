import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import ProofsList from '.'
import * as Styles from '../../../styles'

type OwnProps = {}
export default Container.connect(
  state => ({_proofSuggestions: state.tracker2.proofSuggestions}),
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    providerClicked: (key: string) => dispatch(ProfileGen.createAddProof({platform: key, reason: 'profile'})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    onCancel: dispatchProps.onCancel,
    providerClicked: dispatchProps.providerClicked,
    providers: stateProps._proofSuggestions.map(s => ({
      desc: s.pickerSubtext,
      icon: Styles.isDarkMode() ? s.siteIconFullDarkmode : s.siteIconFull,
      key: s.assertionKey,
      name: s.pickerText,
      new: s.metas.some(({label}) => label === 'new'),
    })),
    title: 'Prove your...',
  })
)(ProofsList)
