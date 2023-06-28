import * as Container from '../../../util/container'
import * as Constants from '../../../constants/profile'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import ProofsList from '.'
import * as Styles from '../../../styles'

export default () => {
  const _proofSuggestions = Container.useSelector(state => state.tracker2.proofSuggestions)
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const addProof = Constants.useState(s => s.dispatch.addProof)
  const providerClicked = (key: string) => {
    addProof(key, 'profile')
  }
  const props = {
    onCancel: onCancel,
    providerClicked: providerClicked,
    providers: _proofSuggestions.map(s => ({
      desc: s.pickerSubtext,
      icon: Styles.isDarkMode() ? s.siteIconFullDarkmode : s.siteIconFull,
      key: s.assertionKey,
      name: s.pickerText,
      new: s.metas.some(({label}) => label === 'new'),
    })),
    title: 'Prove your...',
  }
  return <ProofsList {...props} />
}
