import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'

type OwnProps = Container.RouteProps<Props>

type Props = {
  source: 'newConversation' | 'newFolder' | 'teamAddSomeFailed' | 'teamAddAllFailed' | 'walletsRequest'
  usernames: Array<string>
}

const ContactRestricted = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const description = `@${props.usernames[0]}'s contact restrictions prevent you from requesting a payment. Contact them outside Keybase to proceed.`
  return (
    <Kb.ConfirmModal
      confirmText="Okay"
      description={description}
      header={<Kb.Icon type="iconfont-warning" sizeType="Huge" color={Styles.globalColors.black_50} />}
      onCancel={onBack}
      prompt={`You cannot request a payment from @${props.usernames[0]}.`}
    />
  )
}

export default Container.connect(
  () => ({}),
  () => ({}),
  (_, __, ownProps: OwnProps) => ({
    requestee: Container.getRouteProps(ownProps, 'usernames', []),
  })
)(ContactRestricted)
