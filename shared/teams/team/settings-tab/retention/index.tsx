import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import type {StylesCrossPlatform} from '@/styles'
import SaveIndicator from '@/common-adapters/save-indicator'
import {useConfirm} from './use-confirm'

export type RetentionEntityType = 'adhoc' | 'channel' | 'small team' | 'big team'

export type Props = {
  entityType: RetentionEntityType
  canSetPolicy: boolean
  containerStyle?: Kb.Styles.StylesCrossPlatform
  dropdownStyle?: Kb.Styles.StylesCrossPlatform
  policy: T.Retention.RetentionPolicy
  policyIsExploding: boolean
  teamPolicy?: T.Retention.RetentionPolicy
  load?: () => void
  loading: boolean // for when we're waiting to fetch the team policy
  showInheritOption: boolean
  showOverrideNotice: boolean
  showSaveIndicator: boolean
  teamID: T.Teams.TeamID
  saveRetentionPolicy: (policy: T.Retention.RetentionPolicy) => void
  onSelect?: (policy: T.Retention.RetentionPolicy, changed: boolean, decreased: boolean) => void
}

const RetentionPicker = (p: Props) => {
  const {policy, showInheritOption, teamPolicy, saveRetentionPolicy, entityType} = p
  const {containerStyle, dropdownStyle, policyIsExploding, showOverrideNotice, showSaveIndicator} = p
  const [saving, setSaving] = React.useState(false)
  const [selected, _setSelected] = React.useState<T.Retention.RetentionPolicy | undefined>(undefined)

  const userSelectedRef = React.useRef(false)

  const setSelected = React.useCallback(
    (r: T.Retention.RetentionPolicy, userSelected: boolean) => {
      if (userSelected) {
        userSelectedRef.current = userSelected
      }
      _setSelected(r)
    },
    [_setSelected]
  )

  const showSaved = React.useRef(false)

  const setInitialSelected = React.useCallback(
    (p?: T.Retention.RetentionPolicy) => {
      setSelected(p || policy, false)
    },
    [setSelected, policy]
  )

  const isSelected = React.useCallback(
    (p: T.Retention.RetentionPolicy) => {
      return policyEquals(policy, p)
    },
    [policy]
  )

  const modalConfirmed = useConfirm(s => s.confirmed)
  const modalOpen = useConfirm(s => s.modalOpen)
  const updateConfirm = useConfirm(s => s.dispatch.updateConfirm)

  const [lastConfirmed, setLastConfirmed] = React.useState<T.Retention.RetentionPolicy | undefined>(undefined)
  const [lastModalOpen, setLastModalOpen] = React.useState(modalOpen)

  React.useEffect(() => {
    if (lastModalOpen !== modalOpen) {
      setLastModalOpen(modalOpen)
      if (!modalOpen) {
        setInitialSelected()
      }
    }
  }, [lastModalOpen, modalOpen, setInitialSelected])

  if (lastConfirmed !== modalConfirmed) {
    setTimeout(() => {
      setLastConfirmed(modalConfirmed)
      if (selected === modalConfirmed) {
        selected && saveRetentionPolicy(selected)
      }
      updateConfirm(undefined)
    }, 1)
  }

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  React.useEffect(() => {
    if (userSelectedRef.current) {
      userSelectedRef.current = false
      const changed = !policyEquals(selected, policy)
      const decreased = policyToComparable(selected, teamPolicy) < policyToComparable(policy, teamPolicy)

      // show dialog if decreased, set immediately if not
      if (changed) {
        if (decreased) {
          // show warning
          showSaved.current = false
          if (selected) {
            navigateAppend({
              props: {entityType, policy: selected.type === 'inherit' && teamPolicy ? teamPolicy : selected},
              selected: 'retentionWarning',
            })
          }
        } else {
          const onConfirm = () => {
            selected && saveRetentionPolicy(selected)
          }
          // set immediately
          onConfirm()
          showSaved.current = true
          setSaving(true)
        }
      }
    }
  }, [selected, policy, saveRetentionPolicy, teamPolicy, navigateAppend, entityType])

  const lastPolicy = React.useRef(policy)
  const lastTeamPolicy = React.useRef(teamPolicy)

  React.useEffect(() => {
    if (!policyEquals(policy, lastPolicy.current) || !policyEquals(teamPolicy, lastTeamPolicy.current)) {
      if (policyEquals(policy, selected)) {
        // we just got updated retention policy matching the selected one
        setSaving(false)
      } // we could show a notice that we received a new value in an else block
      setInitialSelected(policy)
    }
    lastPolicy.current = policy
    lastTeamPolicy.current = teamPolicy
  }, [policy, teamPolicy, selected, setInitialSelected])

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p

      const makeItems = () => {
        const policies = Teams.baseRetentionPolicies.slice()
        if (showInheritOption) {
          policies.unshift(Teams.retentionPolicies.policyInherit)
        }
        return policies.reduce<Kb.MenuItems>((arr, policy) => {
          switch (policy.type) {
            case 'retain':
            case 'expire':
              return [
                ...arr,
                {
                  isSelected: isSelected(policy),
                  onClick: () => setSelected(policy, true),
                  title: policy.title,
                } as const,
              ]
            case 'inherit':
              if (teamPolicy) {
                let title = ''
                switch (teamPolicy.type) {
                  case 'retain':
                    title = 'Team default (Never)'
                    break
                  case 'expire':
                  case 'explode':
                    title = `Team default (${teamPolicy.title})`
                    break
                  default:
                }
                return [
                  {
                    isSelected: isSelected(policy),
                    onClick: () => setSelected(policy, true),
                    title,
                  } as const,
                  'Divider' as const,
                  ...arr,
                ]
              } else {
                throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
              }
            case 'explode':
              return [
                ...arr,
                {
                  icon: 'iconfont-timer',
                  iconIsVisible: true,
                  isSelected: isSelected(policy),
                  onClick: () => setSelected(policy, true),
                  title: policy.title,
                } as const,
              ]
            default:
              return arr
          }
        }, new Array<Kb.MenuItems[0]>())
      }
      const items = makeItems()
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          visible={true}
          onHidden={hidePopup}
          items={items}
          position="top center"
        />
      )
    },
    [isSelected, setSelected, showInheritOption, teamPolicy]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box style={Kb.Styles.collapseStyles([Kb.Styles.globalStyles.flexBoxColumn, containerStyle])}>
      {popup}
      <Kb.Box style={styles.heading}>
        <Kb.Text type="BodySmallSemibold">Message deletion</Kb.Text>
      </Kb.Box>
      <Kb.ClickableBox
        onClick={showPopup}
        ref={popupAnchor}
        style={Kb.Styles.collapseStyles([styles.retentionDropdown, dropdownStyle])}
        underlayColor={Kb.Styles.globalColors.white_40}
      >
        <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" fullWidth={true} style={styles.label}>
          {policyToLabel(policy, teamPolicy)}
        </Kb.Box2>
        <Kb.Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} sizeType="Tiny" />
      </Kb.ClickableBox>
      {policyIsExploding && (
        <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} gap="xtiny">
          <Kb.Text type="BodySmall">Participants will see their message explode.</Kb.Text>
          <Kb.Icon color={Kb.Styles.globalColors.black_50} sizeType="Big" type="iconfont-boom" />
        </Kb.Box2>
      )}
      {showOverrideNotice && <Kb.Text type="BodySmall">Individual channels can override this.</Kb.Text>}
      {showSaveIndicator && <SaveIndicator saving={saving} style={styles.saveState} />}
    </Kb.Box>
  )
}

const RetentionDisplay = (
  props: {
    entityType: RetentionEntityType
  } & Props
) => {
  let convType = ''
  switch (props.entityType) {
    case 'big team':
      convType = 'team'
      break
    case 'small team':
      convType = 'chat'
      break
    case 'channel':
      convType = 'channel'
      break
    default:
      throw new Error(`Bad entityType encountered in RetentionDisplay: ${props.entityType}`)
  }
  const text = policyToExplanation(convType, props.policy, props.teamPolicy)
  return (
    <Kb.Box style={Kb.Styles.collapseStyles([Kb.Styles.globalStyles.flexBoxColumn, props.containerStyle])}>
      <Kb.Box style={Kb.Styles.collapseStyles([styles.heading, styles.displayHeading])}>
        <Kb.Text type="BodySmallSemibold">Message deletion</Kb.Text>
      </Kb.Box>
      <Kb.Text type="BodySmall">{text}</Kb.Text>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      displayHeading: {
        marginBottom: 2,
      },
      heading: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        marginBottom: Kb.Styles.globalMargins.tiny,
      },
      label: {
        justifyContent: 'flex-start',
        minHeight: Kb.Styles.isMobile ? 40 : 32,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
      },
      progressIndicator: {
        height: 30,
        marginTop: Kb.Styles.globalMargins.small,
        width: 30,
      },
      retentionDropdown: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          borderColor: Kb.Styles.globalColors.grey,
          borderRadius: Kb.Styles.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          marginBottom: Kb.Styles.globalMargins.tiny,
          minWidth: 220,
          paddingRight: Kb.Styles.globalMargins.small,
        },
        isElectron: {
          width: 220,
        },
      }),
      saveState: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          height: 17,
          justifyContent: 'center',
          marginTop: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          height: Kb.Styles.globalMargins.medium,
        },
      }),
    }) as const
)

// Utilities for transforming retention policies <-> labels
const policyToLabel = (p?: T.Retention.RetentionPolicy, parent?: T.Retention.RetentionPolicy) => {
  let text = ''
  let timer = false
  if (p) {
    switch (p.type) {
      case 'retain':
        text = 'Never auto-delete'
        break
      case 'expire':
      case 'explode':
        text = p.title
        timer = p.type === 'explode'
        break
      case 'inherit':
        if (!parent) {
          // Don't throw an error, as this may happen when deleting a
          // channel.
          text = 'Team default'
          break
        }
        switch (parent.type) {
          case 'retain':
            text = 'Team default (Never)'
            break
          case 'expire':
          case 'explode':
            text = `Team default (${parent.title})`
            timer = parent.type === 'explode'
            break
          default:
        }
    }
  } else {
    text = 'Never auto-delete'
  }
  return [
    timer ? <Kb.Icon color={Kb.Styles.globalColors.black} type="iconfont-timer" key="timer" /> : null,
    <Kb.Text type="BodySemibold" key="label">
      {text}
    </Kb.Text>,
  ]
}
// Use only for comparing policy durations
const policyToComparable = (
  p?: T.Retention.RetentionPolicy,
  parent?: T.Retention.RetentionPolicy
): number => {
  if (!p) {
    return Infinity
  }
  let res: number = -1
  switch (p.type) {
    case 'retain':
      res = Infinity
      break
    case 'inherit':
      if (!parent) {
        throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
      }
      res = policyToComparable(parent)
      break
    case 'expire':
    case 'explode':
      res = p.seconds
      break
  }
  if (res === -1) {
    // no good
    throw new Error('Impossible case encountered: res = -1 in retention policyToComparable')
  }
  return res
}
const policyEquals = (p1?: T.Retention.RetentionPolicy, p2?: T.Retention.RetentionPolicy): boolean => {
  if (p1 && p2) {
    return p1.type === p2.type && p1.seconds === p2.seconds
  }
  return p1 === p2
}
const policyToExplanation = (
  convType: string,
  p: T.Retention.RetentionPolicy,
  parent?: T.Retention.RetentionPolicy
) => {
  let exp = ''
  switch (p.type) {
    case 'inherit':
      {
        if (!parent) {
          throw new Error(`Got policy of type 'inherit' with no inheritable policy`)
        }
        let behavior = ''
        switch (parent.type) {
          case 'inherit':
            throw new Error(`Got invalid type 'inherit' for team-wide policy`)
          case 'retain':
            behavior = 'be retained indefinitely'
            break
          case 'expire':
            behavior = `expire after ${parent.title}`
            break
          case 'explode':
            behavior = `explode after ${parent.title}`
            break
        }
        exp = `Messages in this ${convType} will ${behavior}, which is the team default.`
      }
      break
    case 'retain':
      exp = `Admins have set this ${convType} to retain messages indefinitely.`
      break
    case 'expire':
      exp = `Admins have set this ${convType} to auto-delete messages after ${p.title}.`
      break
    case 'explode':
      exp = `Admins have set messages in this ${convType} to explode after ${p.title}.`
      break
  }
  return exp
}

// Switcher to avoid having RetentionPicker try to process nonexistent data
const RetentionSwitcher = (props: {entityType: RetentionEntityType} & Props) => {
  const {teamID} = props
  const existing = useTeamsState(s => s.teamIDToRetentionPolicy.get(teamID))
  const getTeamRetentionPolicy = useTeamsState(s => s.dispatch.getTeamRetentionPolicy)
  React.useEffect(() => {
    // only load it up if its empty
    if (!existing) {
      getTeamRetentionPolicy(teamID)
    }
  }, [getTeamRetentionPolicy, teamID, existing])
  if (props.loading) {
    return <Kb.ProgressIndicator style={styles.progressIndicator} />
  }
  return props.canSetPolicy ? <RetentionPicker {...props} /> : <RetentionDisplay {...props} />
}

export type OwnProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  containerStyle?: StylesCrossPlatform
  dropdownStyle?: StylesCrossPlatform
  entityType: RetentionEntityType
  showSaveIndicator: boolean
  teamID: T.Teams.TeamID
}

const Container = (ownProps: OwnProps) => {
  const {entityType, conversationIDKey: _cid, teamID} = ownProps

  let loading = false
  let teamPolicy: T.Retention.RetentionPolicy | undefined

  if (_cid) {
  } else if (!entityType.endsWith('team')) {
    throw new Error(`RetentionPicker needs a conversationIDKey to set ${entityType} retention policies`)
  }
  const conversationIDKey = _cid ?? Chat.noConversationIDKey
  let policy = Chat.useConvoState(conversationIDKey, s =>
    _cid ? s.meta.retentionPolicy : Teams.retentionPolicies.policyRetain
  )
  const tempPolicy = useTeamsState(s => Teams.getTeamRetentionPolicyByID(s, teamID))
  if (entityType !== 'adhoc') {
    loading = !tempPolicy
    if (tempPolicy) {
      if (entityType === 'channel') {
        teamPolicy = tempPolicy
      } else {
        policy = tempPolicy
      }
    }
  }

  const canSetPolicy = useTeamsState(
    s => entityType === 'adhoc' || Teams.getCanPerformByID(s, teamID).setRetentionPolicy
  )
  const policyIsExploding =
    policy.type === 'explode' || (policy.type === 'inherit' && teamPolicy?.type === 'explode')
  const showInheritOption = entityType === 'channel'
  const showOverrideNotice = entityType === 'big team'
  const setTeamRetentionPolicy = useTeamsState(s => s.dispatch.setTeamRetentionPolicy)
  const setConvRetentionPolicy = Chat.useConvoState(conversationIDKey, s => s.dispatch.setConvRetentionPolicy)
  const saveRetentionPolicy = (policy: T.Retention.RetentionPolicy) => {
    if (['small team', 'big team'].includes(entityType)) {
      setTeamRetentionPolicy(teamID, policy)
    } else if (['adhoc', 'channel'].includes(entityType)) {
      // we couldn't get here without throwing an error for !conversationIDKey
      setConvRetentionPolicy(policy)
    } else {
      throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
    }
  }
  const props = {
    canSetPolicy,
    entityType,
    loading,
    policy,
    policyIsExploding,
    saveRetentionPolicy,
    showInheritOption,
    showOverrideNotice,
    showSaveIndicator: ownProps.showSaveIndicator,
    teamID,
    teamPolicy,
  }
  return <RetentionSwitcher {...props} />
}

export default Container
