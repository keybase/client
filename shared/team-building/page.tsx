import type {StaticScreenProps} from '@react-navigation/core'
import {useNavigation} from '@react-navigation/core'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import {ModalTitle as TeamsModalTitle} from '../teams/common'
import type {TeamBuilderRouteParams} from './container'
import {TBProvider, useTBContext} from '@/stores/team-building'
import {useModalHeaderState} from '@/stores/modal-header'

const TBHeaderRight = ({
  namespace,
  goButtonLabel,
}: {
  namespace: T.TB.AllowedNamespace
  goButtonLabel?: string
}) => {
  const {enabled, onAction} = useModalHeaderState(
    C.useShallow(s => ({enabled: s.actionEnabled, onAction: s.onAction}))
  )
  if (!isMobile) return null
  if (namespace === 'teams') {
    return (
      <Kb.Text
        type="BodyBigLink"
        onClick={enabled ? onAction : undefined}
        style={!enabled ? styles.hide : undefined}
      >
        Add
      </Kb.Text>
    )
  }
  if (namespace === 'chat' || namespace === 'crypto') {
    return (
      <Kb.Button
        label={goButtonLabel ?? 'Start'}
        onClick={enabled ? onAction : undefined}
        small={true}
        type="Success"
        style={!enabled && styles.hide}
      />
    )
  }
  return null
}

// Writes action state to ModalHeaderStore from inside TBProvider context.
// On iOS, also drives unstable_headerRightItems directly to avoid empty glass circles
// when no members are selected (opacity:0 components still create a glass circle on iOS 26).
const HeaderRightUpdater = ({
  namespace,
  goButtonLabel,
  onFinishTeamBuilding,
}: {
  namespace: T.TB.AllowedNamespace
  goButtonLabel?: string
  onFinishTeamBuilding?: () => void
}) => {
  const navigation = useNavigation()
  const hasTeamSoFar = useTBContext(s => s.teamSoFar.size > 0)
  React.useEffect(() => {
    if (!isMobile) return
    if (namespace !== 'teams' && namespace !== 'chat' && namespace !== 'crypto') return
    const enabled = hasTeamSoFar && !!onFinishTeamBuilding
    if (!onFinishTeamBuilding) {
      useModalHeaderState.setState({actionEnabled: false, onAction: undefined})
    }
    if (isIOS) {
      const label = namespace === 'teams' ? 'Add' : (goButtonLabel ?? 'Start')
      navigation.setOptions({
        unstable_headerRightItems: enabled
          ? () => [{label, onPress: onFinishTeamBuilding, type: 'button' as const}]
          : () => [],
      } as object)
    } else {
      useModalHeaderState.setState({actionEnabled: enabled, onAction: onFinishTeamBuilding})
    }
    return () => {
      if (isIOS) {
        navigation.setOptions({unstable_headerRightItems: () => []} as object)
      } else {
        useModalHeaderState.setState({actionEnabled: false, onAction: undefined})
      }
    }
  }, [namespace, hasTeamSoFar, goButtonLabel, navigation, onFinishTeamBuilding])
  return null
}

// Cancels the building session when the screen stops being visible: removed
// (e.g. default cancel button) or covered by another screen pushed on top.
const CancelOnBlur = () => {
  const navigation = useNavigation()
  const cancelTeamBuilding = useTBContext(s => s.dispatch.cancelTeamBuilding)
  React.useEffect(
    () =>
      navigation.addListener('blur', () => {
        cancelTeamBuilding()
      }),
    [navigation, cancelTeamBuilding]
  )
  return null
}

const styles = Kb.Styles.styleSheetCreate(() => ({hide: {opacity: 0}}) as const)

type OwnProps = StaticScreenProps<TeamBuilderRouteParams>

const getOptions = ({route}: OwnProps) => {
  const namespace = route.params.namespace
  const title = typeof route.params.title === 'string' ? route.params.title : ''
  const goButtonLabel = route.params.goButtonLabel
  const common = {
    modalSize: 'wide',
    overlayAvoidTabs: false,
    overlayTransparent: false,
    // body is a full-bleed scrolling result list; let it run to the screen
    // bottom so its content inset clears the home indicator instead of leaving
    // a blank safe-area strip below the last row
    safeAreaEdges: ['top', 'left', 'right'],
    title,
  } as const

  if (namespace === 'people') {
    return {
      ...common,
      headerShown: isMobile,
      overlayAvoidTabs: true,
      overlayTransparent: true,
    } as const
  }

  if (namespace === 'teams') {
    return {
      ...common,
      // iOS: headerRight omitted; HeaderRightUpdater drives unstable_headerRightItems dynamically
      headerRight: isIOS ? undefined : () => <TBHeaderRight namespace={namespace} />,
      headerTitle: () => (
        <TeamsModalTitle teamID={route.params.teamID ?? T.Teams.noTeamID} title="Search people" />
      ),
    }
  }

  return {
    ...common,
    // iOS: headerRight omitted; HeaderRightUpdater drives unstable_headerRightItems dynamically
    headerRight: isIOS
      ? undefined
      : () => <TBHeaderRight namespace={namespace} goButtonLabel={goButtonLabel} />,
  }
}

const Building = React.lazy(async () => import('./container'))
export type TeamBuilderScreenProps = StaticScreenProps<TeamBuilderRouteParams> & {
  onComplete?: (users: ReadonlySet<T.TB.User>) => void
}

const ScreenBody = ({
  onComplete,
  routeParams,
}: {
  onComplete?: (users: ReadonlySet<T.TB.User>) => void
  routeParams: TeamBuilderRouteParams
}) => {
  const {goButtonLabel, initialError, namespace} = routeParams
  const teamSoFar = useTBContext(s => s.teamSoFar)
  const closeTeamBuilding = useTBContext(s => s.dispatch.closeTeamBuilding)
  const finishedTeamBuilding = useTBContext(s => s.dispatch.finishedTeamBuilding)
  const setError = useTBContext(s => s.dispatch.setError)
  const resetState = useTBContext(s => s.dispatch.resetState)

  // The store is a per-namespace singleton that outlives this screen; a
  // selection left behind by a previous session (blur can miss when the modal
  // is removed) would show stale chips. teams intentionally carries the
  // selection across re-opens for the add-members error path.
  C.useOnMountOnce(() => {
    if (namespace !== 'teams') {
      resetState()
    }
  })

  React.useEffect(() => {
    if (initialError) {
      setError(initialError)
    }
  }, [initialError, setError])

  const onFinishTeamBuilding = React.useCallback(() => {
    if (!teamSoFar.size) return
    const users = new Set(teamSoFar)
    finishedTeamBuilding()
    closeTeamBuilding()
    onComplete?.(users)
  }, [closeTeamBuilding, finishedTeamBuilding, onComplete, teamSoFar])

  return (
    <>
      <CancelOnBlur />
      <HeaderRightUpdater
        namespace={namespace}
        goButtonLabel={goButtonLabel}
        onFinishTeamBuilding={onFinishTeamBuilding}
      />
      <Building
        {...routeParams}
        onFinishTeamBuilding={onFinishTeamBuilding}
      />
    </>
  )
}

export const TeamBuilderScreen = (p: TeamBuilderScreenProps) => (
  <TBProvider namespace={p.route.params.namespace}>
    <ScreenBody routeParams={p.route.params} onComplete={p.onComplete} />
  </TBProvider>
)

export default {
  getOptions,
  screen: TeamBuilderScreen,
}
