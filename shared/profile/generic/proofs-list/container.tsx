import * as C from '../../../constants'
import ProofsList from '.'
import * as Styles from '../../../styles'

export default () => {
  const _proofSuggestions = C.useTrackerState(s => s.proofSuggestions)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const addProof = C.useProfileState(s => s.dispatch.addProof)
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
