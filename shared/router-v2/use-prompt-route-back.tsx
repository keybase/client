import * as React from 'react'
import {NavigationContext} from '@react-navigation/core'
import {registerRouteGone, useRouteKey, type RouteParams} from './route-gone'

type Decline = (promptId: number) => void

// Declines the prompt in the params the route last had, as a retry (a wrong paper key or password)
// sets the next prompt's id on the same route. One per decline, so registering again is the same entry.
const goneByDecline = new WeakMap<Decline, (params: RouteParams) => void>()
const promptRouteGone = (decline: Decline) => {
  let onGone = goneByDecline.get(decline)
  if (!onGone) {
    onGone = (params: RouteParams) => {
      const {promptId} = (params ?? {}) as {promptId?: unknown}
      if (typeof promptId === 'number') {
        decline(promptId)
      }
    }
    goneByDecline.set(decline, onGone)
  }
  return onGone
}

type Props = {
  promptId: number
  isOpen: (promptId: number) => boolean
  // Runs in place of a back of the visible screen while the prompt is open
  onBack?: () => void
  // Settles once the flow is over; undefined when the prompt is not open
  until: (promptId: number) => Promise<unknown> | undefined
  // Answers or refuses the prompt, navigating nowhere: its screen is already going away
  decline: Decline
}

// A prompt screen leaving while its prompt is open would leave the service waiting. A back of the
// visible screen (Android's hardware back, Escape, a pop) runs onBack in its place, as the header back
// does. Any other removal, or a back of a screen with no onBack, declines the prompt once the route
// has left the navigation state, so a removal another listener prevents declines nothing. The flow's
// own navigation comes after it closed the prompt, so it passes.
export const usePromptRouteBack = ({decline, isOpen, onBack, promptId, until}: Props) => {
  // Absent outside a navigator (storybook)
  const navigation = React.useContext(NavigationContext)
  const back = React.useEffectEvent(() => onBack?.())
  const open = React.useEffectEvent((id: number) => isOpen(id))
  const hasBack = !!onBack

  React.useEffect(() => {
    if (!navigation || !hasBack) return
    return navigation.addListener('beforeRemove', e => {
      const {type} = e.data.action
      if (!(type === 'POP' || type === 'GO_BACK') || !open(promptId)) return
      e.preventDefault()
      back()
    })
  }, [navigation, promptId, hasBack])

  // Registered once mounted and again on a retry's new prompt; never undone on cleanup, as the entry
  // ends with the flow
  const routeKey = useRouteKey()
  const register = React.useEffectEvent((key: string, id: number) => {
    const ended = until(id)
    if (ended) {
      registerRouteGone(key, ended, promptRouteGone(decline))
    }
  })
  React.useEffect(() => {
    if (routeKey) {
      register(routeKey, promptId)
    }
  }, [routeKey, promptId])
}
