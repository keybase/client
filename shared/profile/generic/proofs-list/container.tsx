import {namedConnect, RouteProps} from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import ProofsList from '.'
import openURL from '../../../util/open-url'
import * as Styles from '../../../styles'

type OwnProps = RouteProps

export default namedConnect(
  state => ({_proofSuggestions: state.tracker2.proofSuggestions}),
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    providerClicked: (key: string) => dispatch(ProfileGen.createAddProof({platform: key, reason: 'profile'})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    onCancel: dispatchProps.onCancel,
    onClickLearn: () => openURL('https://book.keybase.io/guides/proof-integration-guide'),
    providerClicked: dispatchProps.providerClicked,
    providers: stateProps._proofSuggestions.map(s => ({
      desc: s.pickerSubtext,
      icon: Styles.isDarkMode() ? s.siteIconFullDarkmode : s.siteIconFull,
      key: s.assertionKey,
      name: s.pickerText,
      new: s.metas.some(({label}) => label === 'new'),
    })),
    title: 'Prove your...',
  }),
  'ProofsList'
)(ProofsList)
