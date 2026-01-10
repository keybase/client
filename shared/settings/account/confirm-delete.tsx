import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as PhoneUtil from '@/util/phone-numbers'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsEmailState} from '@/stores/settings-email'

type OwnProps = {
  address: string
  searchable: boolean
  type: 'email' | 'phone'
  lastEmail?: boolean
}

const DeleteModal = (props: OwnProps) => {
  const nav = useSafeNavigation()
  const itemAddress = props.address
  const itemType = props.type
  const itemSearchable = props.searchable
  const lastEmail = props.lastEmail ?? false

  const onCancel = React.useCallback(() => nav.safeNavigateUp(), [nav])
  const editPhone = useSettingsPhoneState(s => s.dispatch.editPhone)
  const editEmail = useSettingsEmailState(s => s.dispatch.editEmail)
  const onConfirm = React.useCallback(() => {
    if (itemType === 'phone') {
      editPhone(itemAddress, true)
    } else {
      editEmail({delete: true, email: itemAddress})
    }

    nav.safeNavigateUp()
  }, [editEmail, editPhone, itemAddress, itemType, nav])

  const icon =
    itemType === 'email'
      ? Kb.Styles.isMobile
        ? 'icon-email-remove-96'
        : 'icon-email-remove-64'
      : Kb.Styles.isMobile
        ? 'icon-phone-number-remove-96'
        : 'icon-phone-number-remove-64'

  const prompt =
    itemType === 'email' ? (
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

  const description = [
    ...(lastEmail
      ? [
          `Since you'll have deleted all email addresses, you won't get email notifications from Keybase anymore.`,
        ]
      : []),
    ...(itemSearchable
      ? [
          `Your friends will no longer be able to find you by this ${
            props.type === 'email' ? 'email address' : 'number'
          }.`,
        ]
      : []),
  ].join(' ')

  return (
    <Kb.ConfirmModal
      icon={icon}
      prompt={prompt}
      description={description}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmText="Yes, delete"
    />
  )
}

export default DeleteModal
