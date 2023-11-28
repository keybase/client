import {ModalTitle as TeamsModalTitle} from '../teams/common'
import type * as Types from './types'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'

export const modalHeaderProps = (
  props: Pick<Types.Props, 'onClose' | 'namespace' | 'teamID' | 'onFinishTeamBuilding' | 'goButtonLabel'> & {
    title: string
    hasTeamSoFar: boolean
  }
) => {
  const {onClose, namespace, hasTeamSoFar, teamID, onFinishTeamBuilding, title, goButtonLabel} = props
  const mobileCancel = Kb.Styles.isMobile ? (
    <Kb.Text type="BodyBigLink" onClick={onClose}>
      Cancel
    </Kb.Text>
  ) : undefined
  switch (namespace) {
    case 'people': {
      return Kb.Styles.isMobile ? {hideBorder: true, leftButton: mobileCancel} : undefined
    }
    case 'teams': {
      return {
        hideBorder: true,
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onClose} />,
        rightButton: Kb.Styles.isMobile ? (
          <Kb.Text
            type="BodyBigLink"
            onClick={hasTeamSoFar ? onFinishTeamBuilding : undefined}
            style={!hasTeamSoFar && styles.hide}
          >
            Done
          </Kb.Text>
        ) : undefined,
        title: <TeamsModalTitle teamID={teamID ?? T.Teams.noTeamID} title="Search people" />,
      }
    }
    case 'chat2': {
      const rightButton = Kb.Styles.isMobile ? (
        <Kb.Button
          label="Start"
          onClick={hasTeamSoFar ? onFinishTeamBuilding : undefined}
          small={true}
          type="Success"
          style={!hasTeamSoFar && styles.hide} // Need to hide this so modal can measure correctly
        />
      ) : undefined
      return {hideBorder: true, leftButton: mobileCancel, rightButton, title: title}
    }
    case 'crypto': {
      const rightButton = Kb.Styles.isMobile ? (
        <Kb.Button
          label={goButtonLabel ?? 'Start'}
          onClick={hasTeamSoFar ? onFinishTeamBuilding : undefined}
          small={true}
          type="Success"
          style={!hasTeamSoFar && styles.hide} // Need to hide this so modal can measure correctly
        />
      ) : undefined
      return {hideBorder: true, leftButton: mobileCancel, rightButton, title: title}
    }
    default: {
      return {hideBorder: true, leftButton: mobileCancel, title: title}
    }
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({hide: {opacity: 0}}) as const)
