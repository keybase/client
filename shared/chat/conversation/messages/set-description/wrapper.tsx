import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type SetDescriptionType from './container'

const SetDescription = React.memo(function SetDescription(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))

  if (message?.type !== 'setDescription') return null

  const SetDescription = require('./container').default as typeof SetDescriptionType
  return (
    <WrapperMessage {...p} {...common}>
      <SetDescription message={message} />
    </WrapperMessage>
  )
})

export default SetDescription
