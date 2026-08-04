import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {RetentionEntityType} from '.'
import ConfirmWarning from '../confirm-warning'
import {useConfirm} from './use-confirm'

type Props = {
  entityType: RetentionEntityType
  exploding: boolean
  timePeriod: string
  onConfirm: () => void
  onBack: () => void
}

const RetentionWarning = (props: Props) => {
  const showChannelWarnings = props.entityType === 'big team'
  const convType: string = getConvType(props.entityType)
  return (
    <ConfirmWarning
      icon={
        <Kb.Icon
          color={props.exploding ? Kb.Styles.globalColors.black : Kb.Styles.globalColors.black_20}
          fontSize={48}
          type={props.exploding ? 'iconfont-bomb-solid' : 'iconfont-timer-solid'}
        />
      }
      header={`${props.exploding ? 'Explode' : 'Auto-delete'} chat messages after ${props.timePeriod}?`}
      body={
        <>
          You are about to set the messages in this {convType} to{' '}
          {props.exploding ? 'explode after ' : 'be automatically deleted after '}
          <Kb.Text type="BodyBold">{props.timePeriod}.</Kb.Text>{' '}
          {showChannelWarnings &&
            "This will affect all the team's channels, except the ones you've set manually."}
        </>
      }
      checkboxLabel={
        <>
          <Kb.Text type="Body">
            I understand that existing messages older than {props.timePeriod} will be deleted now, for
            everyone.
          </Kb.Text>
          {showChannelWarnings && (
            <Kb.Text type="BodySmall">{"Channels you've set manually will not be affected."}</Kb.Text>
          )}
        </>
      }
      confirmLabel={`Yes, set to ${props.timePeriod}`}
      onCancel={props.onBack}
      onConfirm={props.onConfirm}
    />
  )
}

const getConvType = (entityType: RetentionEntityType) => {
  let convType = ''
  switch (entityType) {
    case 'small team':
      convType = "team's chat"
      break
    case 'big team':
      convType = "team's chat"
      break
    case 'channel':
      convType = 'channel'
      break
    case 'adhoc':
      convType = 'conversation'
      break
  }
  if (convType === '') {
    throw new Error(`RetentionWarning: impossible entityType encountered: ${entityType}`)
  }
  return convType
}

type OwnProps = {
  policy: T.Retention.RetentionPolicy
  entityType: RetentionEntityType
}

const RetentionWarningContainer = (ownProps: OwnProps) => {
  const navigateUp = C.Router2.navigateUp
  const openModal = useConfirm(s => s.dispatch.openModal)
  const closeModal = useConfirm(s => s.dispatch.closeModal)
  const updateConfirm = useConfirm(s => s.dispatch.updateConfirm)

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      openModal()
      return () => {
        closeModal()
      }
    }, [openModal, closeModal])
  )

  const onConfirm = () => {
    navigateUp()
    updateConfirm(ownProps.policy)
  }
  return (
    <RetentionWarning
      entityType={ownProps.entityType}
      exploding={ownProps.policy.type === 'explode'}
      onBack={navigateUp}
      onConfirm={onConfirm}
      timePeriod={ownProps.policy.title}
    />
  )
}

export default RetentionWarningContainer
