import type {StaticScreenProps} from '@react-navigation/core'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import * as C from '@/constants'
import {ModalTitle as TeamsModalTitle} from '../teams/common'
import {createTBStore, TBProvider, useTBContext} from '@/stores/team-building'
import {useModalHeaderState} from '@/stores/modal-header'

// Header components that read directly from the TB store (outside TBProvider context)
const TBHeaderLeft = ({namespace}: {namespace: T.TB.AllowedNamespace}) => {
  const store = createTBStore(namespace)
  const cancelTeamBuilding = store(s => s.dispatch.cancelTeamBuilding)
  if (namespace === 'teams') {
    return <Kb.Icon type="iconfont-arrow-left" onClick={cancelTeamBuilding} />
  }
  if (Kb.Styles.isMobile) {
    return (
      <Kb.Text type="BodyBigLink" onClick={cancelTeamBuilding}>
        Cancel
      </Kb.Text>
    )
  }
  return null
}

const TBHeaderRight = ({namespace, goButtonLabel}: {namespace: T.TB.AllowedNamespace; goButtonLabel?: string}) => {
  const {enabled, onAction} = useModalHeaderState(
    C.useShallow(s => ({enabled: s.actionEnabled, onAction: s.onAction}))
  )
  if (!Kb.Styles.isMobile) return null
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

// Writes action state to ModalHeaderStore from inside TBProvider context
const HeaderRightUpdater = ({namespace}: {namespace: T.TB.AllowedNamespace}) => {
  const hasTeamSoFar = useTBContext(s => s.teamSoFar.size > 0)
  const finishTeamBuilding = useTBContext(s => s.dispatch.finishTeamBuilding)
  const finishedTeamBuilding = useTBContext(s => s.dispatch.finishedTeamBuilding)
  React.useEffect(() => {
    if (!Kb.Styles.isMobile) return
    const onFinish = namespace === 'teams' ? finishTeamBuilding : finishedTeamBuilding
    if (namespace === 'teams' || namespace === 'chat' || namespace === 'crypto') {
      useModalHeaderState.setState({
        actionEnabled: hasTeamSoFar,
        onAction: onFinish,
      })
    }
    return () => {
      useModalHeaderState.setState({actionEnabled: false, onAction: undefined})
    }
  }, [namespace, hasTeamSoFar, finishTeamBuilding, finishedTeamBuilding])
  return null
}

const styles = Kb.Styles.styleSheetCreate(() => ({hide: {opacity: 0}}) as const)

const getOptions = ({route}: OwnProps) => {
  const namespace = route.params.namespace
  const title = typeof route.params.title === 'string' ? route.params.title : ''
  const goButtonLabel = route.params.goButtonLabel
  const common = {
    headerLeft: () => <TBHeaderLeft namespace={namespace} />,
    headerRight: () => <TBHeaderRight namespace={namespace} goButtonLabel={goButtonLabel} />,
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
      headerTitle: () => (
        <TeamsModalTitle teamID={route.params.teamID ?? T.Teams.noTeamID} title="Search people" />
      ),
    }
  }

  return common
}

const Building = React.lazy(async () => import('./container'))
type OwnProps = StaticScreenProps<React.ComponentProps<typeof Building>>

const Screen = (p: OwnProps) => (
  <TBProvider namespace={p.route.params.namespace}>
    <HeaderRightUpdater namespace={p.route.params.namespace} />
    <Building {...p.route.params} />
  </TBProvider>
)

export default {
  getOptions,
  screen: Screen,
}
