import * as React from 'react'
import {default as Button, type Props as ButtonProps} from './button'
import type ClickableBox from './clickable-box'
import * as Container from '../util/container'
import * as WaitingConstants from '../constants/waiting'

const Kb = {
  Button,
}

export type Props = {
  onlyDisable?: boolean
  waitingKey: Array<string> | string | null
} & ButtonProps

/* Waiting button is a <Kb.Button /> with handling of waiting states.
 *
 * There are two forms:
 *  waitingKey is null: The spinner activates as soon as the button is clicked,
 *  and stays there until the component's unmounted.  This can be used in
 *  places where the end of an async action will coincide with the component
 *  unmounting.
 *
 *  waitingKey is non-null: The spinner follows the given key in our generic
 *  waiting store (store.waiting), which will be set by a saga somewhere.
 */

const WaitingButton = React.forwardRef<ClickableBox, Props>(function WaitingButton(props, ref) {
  const {onlyDisable, waitingKey, ...buttonProps} = props
  const storeWaiting = Container.useSelector(state =>
    typeof waitingKey === 'string'
      ? WaitingConstants.anyWaiting(state, waitingKey)
      : WaitingConstants.anyWaiting(state, ...(waitingKey || []))
  )

  const [localWaiting, setLocalWaiting] = React.useState(false)

  if (onlyDisable && !waitingKey) {
    throw new Error('WaitingButton onlyDisable should only be used with a waiting key')
  }
  const waiting = storeWaiting || localWaiting
  return (
    <Kb.Button
      ref={ref}
      {...buttonProps}
      onClick={event => {
        if (!waitingKey) {
          setLocalWaiting(true)
        }
        buttonProps.onClick?.(event)
      }}
      disabled={onlyDisable ? waiting || props.disabled : props.disabled}
      waiting={onlyDisable ? false : waiting}
    />
  )
})

export default WaitingButton
