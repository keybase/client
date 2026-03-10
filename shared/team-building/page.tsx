import type {StaticScreenProps} from '@react-navigation/core'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {ModalTitle as TeamsModalTitle} from '../teams/common'
import {createTBStore, TBProvider} from '@/stores/team-building'

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
  const store = createTBStore(namespace)
  const hasTeamSoFar = store(s => s.teamSoFar.size > 0)
  const finishTeamBuilding = store(s => s.dispatch.finishTeamBuilding)
  const finishedTeamBuilding = store(s => s.dispatch.finishedTeamBuilding)
  const onFinish = namespace === 'teams' ? finishTeamBuilding : finishedTeamBuilding
  if (!Kb.Styles.isMobile) return null
  if (namespace === 'teams') {
    return (
      <Kb.Text
        type="BodyBigLink"
        onClick={hasTeamSoFar ? onFinish : undefined}
        style={!hasTeamSoFar && styles.hide}
      >
        Done
      </Kb.Text>
    )
  }
  if (namespace === 'chat' || namespace === 'crypto') {
    return (
      <Kb.Button
        label={goButtonLabel ?? 'Start'}
        onClick={hasTeamSoFar ? onFinish : undefined}
        small={true}
        type="Success"
        style={!hasTeamSoFar && styles.hide}
      />
    )
  }
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
    <Building {...p.route.params} />
  </TBProvider>
)

export default {
  getOptions,
  screen: Screen,
}
