import * as Kb from '@/common-adapters'
import * as React from 'react'
import {navigateUp} from '@/constants/router'
import {useNavigation} from '@react-navigation/native'
import {useAnyWaiting, useWaitingState} from '@/stores/waiting'
import {waitingKeyProvision} from '@/constants/strings'
import {pauseProvision} from './flow'

const showDelayMs = 300
const stillTryingMs = 10000

// Full-screen feedback while the provision RPC is working server-side. Appears only after a
// short delay so fast responses never flash, and offers an escape hatch once the wait is long.
// Render as the last child of the screen's outermost container.
const ProvisionWaitingOverlay = () => {
  const waiting = useAnyWaiting(waitingKeyProvision)
  const [phase, setPhase] = React.useState<'hidden' | 'spinner' | 'stillTrying'>('hidden')
  const navigation = useNavigation()

  React.useEffect(() => {
    if (!waiting) {
      return
    }
    const spinnerID = setTimeout(() => setPhase('spinner'), showDelayMs)
    const stillTryingID = setTimeout(() => setPhase('stillTrying'), stillTryingMs)
    return () => {
      clearTimeout(spinnerID)
      clearTimeout(stillTryingID)
      // Reset here (not in the body above) so we don't setState synchronously while the
      // effect is running — this cleanup fires exactly when `waiting` flips back to false.
      setPhase('hidden')
    }
  }, [waiting])

  React.useEffect(() => {
    return navigation.addListener('beforeRemove', e => {
      // Only a genuine back-out parks the flow. beforeRemove also fires when the router removes
      // screens on state changes (e.g. login success unmounting the logged-out stack) and pausing
      // there would cancel an RPC that is about to resolve.
      const {type} = e.data.action
      if (type !== 'POP' && type !== 'GO_BACK') {
        return
      }
      if ((useWaitingState.getState().counts.get(waitingKeyProvision) ?? 0) > 0) {
        pauseProvision()
      }
    })
  }, [navigation])

  if (phase === 'hidden') {
    return null
  }

  const onCancel = () => {
    pauseProvision()
    navigateUp()
  }

  return (
    <Kb.Box2 direction="vertical" style={styles.overlay} centerChildren={true} gap="small">
      <Kb.ProgressIndicator type="Large" />
      {phase === 'stillTrying' && (
        <>
          <Kb.Text type="BodySmall">Still trying to reach the server…</Kb.Text>
          <Kb.Button label="Cancel" mode="Secondary" onClick={onCancel} />
        </>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      overlay: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        backgroundColor: Kb.Styles.globalColors.white_75,
        zIndex: 10,
      },
    }) as const
)

export default ProvisionWaitingOverlay
