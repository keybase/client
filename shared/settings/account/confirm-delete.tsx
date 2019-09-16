import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import * as PhoneUtil from '../../util/phone-numbers'

type Props = {
  address: string
  searchable: boolean
  onCancel: () => void
  onConfirm: () => void
  type: 'email' | 'phone'
}

const getIcon = (props: Props) => {
  if (props.type === 'email') {
    return Styles.isMobile ? 'icon-email-remove-96' : 'icon-email-remove-64'
  }
  return Styles.isMobile ? 'icon-phone-number-remove-96' : 'icon-phone-number-remove-64'
}
const getPrompt = (props: Props) =>
  props.type === 'email' ? (
    <Kb.Box2 direction="vertical" alignItems="center">
      <Kb.Text type="HeaderBig">Delete email</Kb.Text>
      <Kb.Text type="HeaderBig">{props.address}?</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical" alignItems="center">
      <Kb.Text type="HeaderBig">Delete number</Kb.Text>
      <Kb.Text type="HeaderBig">{PhoneUtil.e164ToDisplay(props.address)}?</Kb.Text>
    </Kb.Box2>
  )

const ConfirmDeleteAddress = (props: Props) => (
  <Kb.ConfirmModal
    icon={getIcon(props)}
    prompt={getPrompt(props)}
    description={
      props.searchable
        ? `Your friends will no longer be able to find you by this ${
            props.type === 'email' ? 'email address' : 'number'
          }.`
        : ''
    }
    onCancel={props.onCancel}
    onConfirm={props.onConfirm}
    confirmText="Yes, delete"
  />
)

type OwnProps = Container.RouteProps<{address: string; searchable: boolean; type: 'email' | 'phone'}>

const DeleteModal = (props: OwnProps) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const itemAddress = Container.getRouteProps(props, 'address', '')
  const itemType = Container.getRouteProps(props, 'type', 'email')
  const itemSearchable = Container.getRouteProps(props, 'searchable', false)

  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const onConfirm = React.useCallback(() => {
    if (itemType === 'phone') {
      dispatch(SettingsGen.createEditPhone({delete: true, phone: itemAddress}))
    } else {
      dispatch(SettingsGen.createEditEmail({delete: true, email: itemAddress}))
    }

    dispatch(nav.safeNavigateUpPayload())
  }, [dispatch, itemAddress, itemType, nav])

  return (
    <ConfirmDeleteAddress
      address={itemAddress}
      searchable={itemSearchable}
      type={itemType}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

export {ConfirmDeleteAddress, DeleteModal}
