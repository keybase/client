import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import {RouteProps} from '../../route-tree/render-route'

type Props = {
  address: string
  searchable: boolean
  onCancel: () => void
  onConfirm: () => void
  type: 'email' | 'phone'
}

const getIcon = props => {
  if (props.type === 'email') {
    return Styles.isMobile ? 'icon-email-remove-64' : 'icon-email-remove-48'
  }
  return Styles.isMobile ? 'icon-phone-number-remove-64' : 'icon-phone-number-remove-48'
}

const ConfirmDeleteAddress = (props: Props) => (
  <Kb.ConfirmModal
    icon={getIcon(props)}
    prompt={`Delete ${props.type === 'email' ? 'address' : 'number'} \n${props.address}?`}
    description={
      props.searchable
        ? `Your friends will no longer be able to find you by this ${
            props.type === 'email' ? 'email address' : 'number'
          }.`
        : ''
    }
    onCancel={props.onCancel}
    onConfirm={props.onConfirm}
  />
)

type OwnProps = RouteProps<{address: string; searchable: boolean; type: string}>

const DeleteModal = (props: OwnProps) => {
  const dispatch = Container.useDispatch()

  const itemAddress = Container.getRouteProps(props, 'address')
  const itemSearchable = Container.getRouteProps(props, 'searchable')
  const itemType = Container.getRouteProps(props, 'type')

  const onCancel = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onConfirm = React.useCallback(() => {
    if (itemType === 'phone') {
      dispatch(SettingsGen.createEditPhone({delete: true, phone: itemAddress}))
    } else {
      dispatch(SettingsGen.createEditEmail({delete: true, email: itemAddress}))
    }

    dispatch(RouteTreeGen.createNavigateUp())
  }, [dispatch, itemAddress, itemType])

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
