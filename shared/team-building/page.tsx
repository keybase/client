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
  goButtonLabel?: string | undefined
}) => {
  const {enabled, onAction} = useModalHeaderState(
    C.useShallow(s => ({enabled: s.actionEnabled, onAction: s.onAction}))
  )
  if (!Kb.Styles.isMobile) return null
  if (namespace === 'teams') {
    return (
      <Kb.Text
        type="BodyBigLink"
        {...(enabled && onAction ? {onClick: onAction} : {})}
        {...(!enabled ? {style: styles.hide} : {})}
      >
        Add
      </Kb.Text>
    )
  }
  if (namespace === 'chat' || namespace === 'crypto') {
    return (
      <Kb.Button
        label={goButtonLabel ?? 'Start'}
        small={true}
        type="Success"
        {...(enabled && onAction ? {onClick: onAction} : {})}
        {...(!enabled ? {style: styles.hide} : {})}
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
  goButtonLabel?: string | undefined
  onFinishTeamBuilding?: (() => void) | undefined
}) => {
  const navigation = useNavigation()
  const hasTeamSoFar = useTBContext(s => s.teamSoFar.size > 0)
  React.useEffect(() => {
    if (!Kb.Styles.isMobile) return
    if (namespace !== 'teams' && namespace !== 'chat' && namespace !== 'crypto') return
    const enabled = hasTeamSoFar && !!onFinishTeamBuilding
    if (!onFinishTeamBuilding) {
      useModalHeaderState.setState({actionEnabled: false, onAction: undefined})
    }
    if (Kb.Styles.isIOS) {
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
      if (Kb.Styles.isIOS) {
        navigation.setOptions({unstable_headerRightItems: () => []} as object)
      } else {
        useModalHeaderState.setState({actionEnabled: false, onAction: undefined})
      }
    }
  }, [namespace, hasTeamSoFar, goButtonLabel, navigation, onFinishTeamBuilding])
  return null
}

// Calls resetState when the screen is removed (e.g. default cancel button pressed)
const CancelOnRemove = ({
  skipResetOnRemoveRef,
}: {
  skipResetOnRemoveRef: React.MutableRefObject<boolean>
}) => {
  const navigation = useNavigation()
  const resetState = useTBContext(s => s.dispatch.resetState)
  React.useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (skipResetOnRemoveRef.current) return
        resetState()
      }),
    [navigation, resetState, skipResetOnRemoveRef]
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
    modalStyle: {height: 560} as const,
    overlayAvoidTabs: false,
    overlayStyle: {alignSelf: 'center'} as const,
    overlayTransparent: false,
    title,
  } as const

  if (namespace === 'people') {
    return {
      ...common,
      headerShown: Kb.Styles.isMobile,
      modalStyle: {height: 560, width: '100%'},
      overlayAvoidTabs: true,
      overlayStyle: {
        alignSelf: 'flex-start',
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
        paddingTop: Kb.Styles.globalMargins.mediumLarge,
      } as const,
      overlayTransparent: true,
    } as const
  }

  if (namespace === 'teams') {
    return {
      ...common,
      // iOS: headerRight omitted; HeaderRightUpdater drives unstable_headerRightItems dynamically
      headerTitle: () => (
        <TeamsModalTitle teamID={route.params.teamID ?? T.Teams.noTeamID} title="Search people" />
      ),
      ...(Kb.Styles.isIOS ? {} : {headerRight: () => <TBHeaderRight namespace={namespace} />}),
    }
  }

  return {
    ...common,
    // iOS: headerRight omitted; HeaderRightUpdater drives unstable_headerRightItems dynamically
    ...(Kb.Styles.isIOS
      ? {}
      : {headerRight: () => <TBHeaderRight namespace={namespace} goButtonLabel={goButtonLabel} />}),
  }
}

const Building = React.lazy(async () => import('./container'))
export type TeamBuilderScreenProps = StaticScreenProps<TeamBuilderRouteParams> & {
  onComplete?: ((users: ReadonlySet<T.TB.User>) => void) | undefined
}

const ScreenBody = ({
  onComplete,
  routeParams,
}: {
  onComplete?: ((users: ReadonlySet<T.TB.User>) => void) | undefined
  routeParams: TeamBuilderRouteParams
}) => {
  const {goButtonLabel, namespace} = routeParams
  const teamSoFar = useTBContext(s => s.teamSoFar)
  const closeTeamBuilding = useTBContext(s => s.dispatch.closeTeamBuilding)
  const finishedTeamBuilding = useTBContext(s => s.dispatch.finishedTeamBuilding)
  const skipResetOnRemoveRef = React.useRef(false)

  const onFinishTeamBuilding = React.useCallback(() => {
    if (!teamSoFar.size) return
    const users = new Set(teamSoFar)
    skipResetOnRemoveRef.current = true
    finishedTeamBuilding()
    closeTeamBuilding()
    onComplete?.(users)
    setTimeout(() => {
      skipResetOnRemoveRef.current = false
    }, 0)
  }, [closeTeamBuilding, finishedTeamBuilding, onComplete, teamSoFar])

  return (
    <>
      <CancelOnRemove skipResetOnRemoveRef={skipResetOnRemoveRef} />
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
