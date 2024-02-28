import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import * as PhoneUtil from '@/util/phone-numbers'

type Props = {
  address: string
  searchable: boolean
  lastEmail: boolean
  onCancel: () => void
  onConfirm: () => void
  type: 'email' | 'phone'
}

const getIcon = (props: Props) => {
  if (props.type === 'email') {
    return Kb.Styles.isMobile ? 'icon-email-remove-96' : 'icon-email-remove-64'
  }
  return Kb.Styles.isMobile ? 'icon-phone-number-remove-96' : 'icon-phone-number-remove-64'
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

const getDescription = (props: Props) => {
  return [
    ...(props.lastEmail
      ? [
          `Since you'll have deleted all email addresses, you won't get email notifications from Keybase anymore.`,
        ]
      : []),
    ...(props.searchable
      ? [
          `Your friends will no longer be able to find you by this ${
            props.type === 'email' ? 'email address' : 'number'
          }.`,
        ]
      : []),
  ].join(' ')
}

const ConfirmDeleteAddress = (props: Props) => (
  <Kb.ConfirmModal
    icon={getIcon(props)}
    prompt={getPrompt(props)}
    description={getDescription(props)}
    onCancel={props.onCancel}
    onConfirm={props.onConfirm}
    confirmText="Yes, delete"
  />
)

type OwnProps = {
  address: string
  searchable: boolean
  type: 'email' | 'phone'
  lastEmail?: boolean
}

const DeleteModal = (props: OwnProps) => {
  const nav = Container.useSafeNavigation()
  const itemAddress = props.address
  const itemType = props.type
  const itemSearchable = props.searchable
  const lastEmail = props.lastEmail ?? false

  const onCancel = React.useCallback(() => nav.safeNavigateUp(), [nav])
  const editPhone = C.useSettingsPhoneState(s => s.dispatch.editPhone)
  const editEmail = C.useSettingsEmailState(s => s.dispatch.editEmail)
  const onConfirm = React.useCallback(() => {
    if (itemType === 'phone') {
      editPhone(itemAddress, true)
    } else {
      editEmail({delete: true, email: itemAddress})
    }

    nav.safeNavigateUp()
  }, [editEmail, editPhone, itemAddress, itemType, nav])

  return (
    <ConfirmDeleteAddress
      address={itemAddress}
      searchable={itemSearchable}
      lastEmail={!!lastEmail}
      type={itemType}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

export {DeleteModal}
