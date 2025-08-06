import * as React from 'react'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import type {RetentionEntityType} from '@/teams/team/settings-tab/retention'
import RetentionWarning from '.'
import {useConfirm} from '../use-confirm'

type OwnProps = {
  policy: T.Retention.RetentionPolicy
  entityType: RetentionEntityType
}

const Container = (ownProps: OwnProps) => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const openModal = useConfirm(s => s.dispatch.openModal)
  const closeModal = useConfirm(s => s.dispatch.closeModal)

  const onBack = () => {
    navigateUp()
  }

  const entityType = ownProps.entityType
  const policy = ownProps.policy

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      openModal()
      return () => {
        closeModal()
      }
    }, [openModal, closeModal])
  )

  const updateConfirm = useConfirm(s => s.dispatch.updateConfirm)
  const onConfirm = () => {
    navigateUp()
    updateConfirm(policy)
  }
  const props = {
    ...ownProps,
    entityType,
    exploding: policy.type === 'explode',
    onBack,
    onConfirm,
    timePeriod: policy.title,
  }
  return <RetentionWarning {...props} />
}

export default Container
