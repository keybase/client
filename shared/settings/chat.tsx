import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import Group from './group'
import {loadSettings} from './load-settings'
import useNotificationSettings from './notifications/use-notification-settings'
import {useConfigState} from '@/stores/config'
import {useShellState} from '@/stores/shell'
import {useTeamsList} from '@/teams/use-teams-list'

const emptyList = new Array<string>()

type ContactSettingsTeamsList = {[k in T.RPCGen.TeamID]: boolean}
type NotificationSettingsState = ReturnType<typeof useNotificationSettings>

const useContactSettings = () => {
  const loadContactSettingsRPC = C.useRPC(T.RPCGen.accountUserGetContactSettingsRpcPromise)
  const saveContactSettingsRPC = C.useRPC(T.RPCGen.accountUserSetContactSettingsRpcPromise)
  const [error, setError] = React.useState('')
  const [settings, setSettings] = React.useState<T.RPCGen.ContactSettings>()

  const contactSettingsRefresh = React.useCallback(() => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    loadContactSettingsRPC(
      [undefined],
      nextSettings => {
        setError('')
        setSettings(nextSettings)
      },
      () => {
        setError('Unable to load contact settings, please try again.')
      }
    )
  }, [loadContactSettingsRPC])

  const contactSettingsSaved = React.useCallback(
    (
      enabled: boolean,
      indirectFollowees: boolean,
      teamsEnabled: boolean,
      teamsList: ContactSettingsTeamsList
    ) => {
      if (!useConfigState.getState().loggedIn) {
        return
      }
      const teams = Object.entries(teamsList).map(([teamID, teamEnabled]) => ({
        enabled: teamEnabled,
        teamID,
      }))
      saveContactSettingsRPC(
        [
          {
            settings: {
              allowFolloweeDegrees: indirectFollowees ? 2 : 1,
              allowGoodTeams: teamsEnabled,
              enabled,
              teams,
            },
          },
          C.waitingKeySettingsChatContactSettingsSave,
        ],
        () => {
          contactSettingsRefresh()
        },
        () => {
          setError('Unable to save contact settings, please try again.')
        }
      )
    },
    [contactSettingsRefresh, saveContactSettingsRPC]
  )

  return {contactSettingsRefresh, contactSettingsSaved, error, settings}
}

const useUnfurlSettings = () => {
  const loadUnfurlSettingsRPC = C.useRPC(T.RPCChat.localGetUnfurlSettingsRpcPromise)
  const saveUnfurlSettingsRPC = C.useRPC(T.RPCChat.localSaveUnfurlSettingsRpcPromise)
  const [error, setError] = React.useState('')
  const [mode, setMode] = React.useState<T.RPCChat.UnfurlMode>()
  const [whitelist, setWhitelist] = React.useState<ReadonlyArray<string>>(emptyList)

  const unfurlSettingsRefresh = React.useCallback(() => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    loadUnfurlSettingsRPC(
      [undefined, C.waitingKeySettingsChatUnfurl],
      result => {
        setError('')
        setMode(result.mode)
        setWhitelist(result.whitelist ?? emptyList)
      },
      () => {
        setError('Unable to load link preview settings, please try again.')
      }
    )
  }, [loadUnfurlSettingsRPC])

  const unfurlSettingsSaved = React.useCallback(
    (unfurlMode: T.RPCChat.UnfurlMode, unfurlWhitelist: ReadonlyArray<string>) => {
      setError('')
      setMode(unfurlMode)
      setWhitelist(unfurlWhitelist)
      if (!useConfigState.getState().loggedIn) {
        return
      }
      saveUnfurlSettingsRPC(
        [{mode: unfurlMode, whitelist: unfurlWhitelist}, C.waitingKeySettingsChatUnfurl],
        () => {
          unfurlSettingsRefresh()
        },
        () => {
          setError('Unable to save link preview settings, please try again.')
        }
      )
    },
    [saveUnfurlSettingsRPC, unfurlSettingsRefresh]
  )

  return {error, mode, unfurlSettingsRefresh, unfurlSettingsSaved, whitelist}
}

const Security = ({allowEdit, groups, refresh, toggle}: NotificationSettingsState) => {
  const {contactSettingsRefresh, contactSettingsSaved, error, settings} = useContactSettings()
  const {teams} = useTeamsList()
  const teamMeta = [...teams].sort((a, b) => a.teamname.localeCompare(b.teamname))
  const _contactSettingsEnabled = settings?.enabled
  const _contactSettingsIndirectFollowees = settings?.allowFolloweeDegrees === 2
  const _contactSettingsTeams = settings?.teams
  const _contactSettingsTeamsEnabled = settings?.allowGoodTeams

  const [contactSettingsEnabled, setContactSettingsEnabled] = React.useState(_contactSettingsEnabled)
  const [contactSettingsIndirectFollowees, setContactSettingsIndirectFollowees] = React.useState(
    _contactSettingsIndirectFollowees
  )
  const [contactSettingsTeamsEnabled, setContactSettingsTeamsEnabled] = React.useState(
    _contactSettingsTeamsEnabled
  )

  const serverSelectedTeams = new Map(_contactSettingsTeams?.map(t => [t.teamID, {enabled: t.enabled}]))

  const _contactSettingsSelectedTeams = (() => {
    const s: {[K in T.Teams.TeamID]: boolean} = {}
    teamMeta.forEach(t => {
      if (serverSelectedTeams.has(t.id)) {
        // If there's a server-provided previous choice, use that.
        s[t.id] = !!serverSelectedTeams.get(t.id)?.enabled
      } else {
        // Else, default the team to being selected if the team is non-open.
        s[t.id] = !t.isOpen
      }
    })
    return s
  })()

  const [contactSettingsSelectedTeams, setContactSettingsSelectedTeams] = React.useState(
    _contactSettingsSelectedTeams
  )
  const lastContactSettingsEnabledRef = React.useRef(_contactSettingsEnabled)
  React.useEffect(() => {
    if (
      _contactSettingsEnabled !== lastContactSettingsEnabledRef.current ||
      (_contactSettingsEnabled !== undefined && contactSettingsEnabled === undefined)
    ) {
      setContactSettingsEnabled(_contactSettingsEnabled)
    }
    lastContactSettingsEnabledRef.current = _contactSettingsEnabled
  }, [_contactSettingsEnabled, contactSettingsEnabled])

  const lastContactSettingsIndirectFolloweesRef = React.useRef(_contactSettingsIndirectFollowees)
  React.useEffect(() => {
    if (_contactSettingsIndirectFollowees !== lastContactSettingsIndirectFolloweesRef.current) {
      setContactSettingsIndirectFollowees(_contactSettingsIndirectFollowees)
    }
    lastContactSettingsIndirectFolloweesRef.current = _contactSettingsIndirectFollowees
  }, [_contactSettingsIndirectFollowees, contactSettingsIndirectFollowees])

  const lastContactSettingsTeamsEnabled = React.useRef(_contactSettingsTeamsEnabled)
  React.useEffect(() => {
    if (
      _contactSettingsTeamsEnabled !== lastContactSettingsTeamsEnabled.current ||
      (_contactSettingsTeamsEnabled !== undefined && contactSettingsTeamsEnabled === undefined)
    ) {
      setContactSettingsTeamsEnabled(_contactSettingsTeamsEnabled)
    }
    lastContactSettingsTeamsEnabled.current = _contactSettingsTeamsEnabled
  }, [_contactSettingsTeamsEnabled, contactSettingsTeamsEnabled])

  React.useEffect(() => {
    // Create an initial copy of teams data into state, so it can be mutated there.
    if (
      Object.keys(_contactSettingsSelectedTeams).length > 0 &&
      Object.keys(contactSettingsSelectedTeams).length === 0
    ) {
      setContactSettingsSelectedTeams(_contactSettingsSelectedTeams)
    }
  }, [_contactSettingsSelectedTeams, contactSettingsSelectedTeams])

  React.useEffect(() => {
    loadSettings()
    refresh()
    contactSettingsRefresh()
  }, [contactSettingsRefresh, refresh])

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
        <Kb.Text type="Header">Security</Kb.Text>
      </Kb.Box2>

      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
        {!!groups.get('security')?.settings && (
          <Group
            allowEdit={allowEdit}
            groupName="security"
            onToggle={toggle}
            settings={groups.get('security')!.settings}
            unsubscribedFromAll={false}
          />
        )}

        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Checkbox
            label="Only let someone message you or add you to a team if..."
            onCheck={() => setContactSettingsEnabled(s => !s)}
            checked={!!contactSettingsEnabled}
            disabled={contactSettingsEnabled === undefined}
          />
          {!!contactSettingsEnabled && (
            <>
              <Kb.Box2
                direction="vertical"
                fullWidth={true}
                gap={Kb.Styles.isMobile ? 'small' : undefined}
                gapStart={Kb.Styles.isMobile}
                style={styles.checkboxIndented}
              >
                <Kb.Checkbox label="You follow them, or..." checked={true} disabled={true} />
                <Kb.Checkbox
                  label="You follow someone who follows them, or..."
                  onCheck={checked => setContactSettingsIndirectFollowees(checked)}
                  checked={!!contactSettingsIndirectFollowees}
                />
                <Kb.Checkbox
                  label="They're in one of these teams with you:"
                  onCheck={checked => setContactSettingsTeamsEnabled(checked)}
                  checked={!!contactSettingsTeamsEnabled}
                  disabled={false}
                />
              </Kb.Box2>

              {contactSettingsTeamsEnabled && (
                <Kb.Box2
                  direction="vertical"
                  fullWidth={true}
                  gap={Kb.Styles.isMobile ? 'small' : undefined}
                  gapStart={false}
                  gapEnd={true}
                >
                  {teamMeta.map(teamMeta => (
                    <TeamRow
                      checked={contactSettingsSelectedTeams[teamMeta.id] ?? false}
                      key={teamMeta.id}
                      isOpen={teamMeta.isOpen}
                      name={teamMeta.teamname}
                      onCheck={(checked: boolean) =>
                        setContactSettingsSelectedTeams(s => ({
                          ...s,
                          [teamMeta.id]: checked,
                        }))
                      }
                    />
                  ))}
                </Kb.Box2>
              )}
            </>
          )}
          <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} style={styles.btnContainer}>
            <Kb.WaitingButton
              onClick={() =>
                contactSettingsSaved(
                  !!contactSettingsEnabled,
                  !!contactSettingsIndirectFollowees,
                  !!contactSettingsTeamsEnabled,
                  contactSettingsSelectedTeams
                )
              }
              label="Save"
              small={true}
              style={styles.save}
              waitingKey={C.waitingKeySettingsChatContactSettingsSave}
            />
            {!!error && (
              <Kb.Text type="BodySmall" style={styles.error}>
                {error}
              </Kb.Text>
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const Links = () => {
  const {error, mode, unfurlSettingsRefresh, unfurlSettingsSaved, whitelist} = useUnfurlSettings()
  const [selected, setSelected] = React.useState(mode)
  const [unfurlWhitelistRemoved, setUnfurlWhitelistRemoved] = React.useState<{[K in string]: boolean}>({})
  const getUnfurlWhitelist = (filtered: boolean) =>
    filtered ? whitelist.filter(w => !unfurlWhitelistRemoved[w]) : whitelist
  const allowSave = mode !== selected || Object.keys(unfurlWhitelistRemoved).length > 0
  const onSave = () => {
    const next = whitelist.filter(w => {
      return !unfurlWhitelistRemoved[w]
    })
    unfurlSettingsSaved(selected || T.RPCChat.UnfurlMode.always, next)
  }

  const toggleUnfurlWhitelist = (domain: string) => {
    setUnfurlWhitelistRemoved(prev => ({
      ...prev,
      [domain]: !prev[domain],
    }))
  }

  React.useEffect(() => {
    unfurlSettingsRefresh()
  }, [unfurlSettingsRefresh])

  const lastModeRef = React.useRef(mode)
  React.useEffect(() => {
    if (lastModeRef.current !== mode) {
      lastModeRef.current = mode
      setSelected(mode)
    }
  }, [mode])

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.innerContainer}>
        <Kb.Text type="Header">Link previews</Kb.Text>
        <Kb.Text type="BodySmall">
          Your Keybase app will visit the links you share and automatically post previews.
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        gap="xtiny"
        gapStart={true}
        style={styles.innerContainer}
      >
        <Kb.RadioButton
          key="rbalways"
          label="Always"
          onSelect={() => setSelected(T.RPCChat.UnfurlMode.always)}
          selected={selected === T.RPCChat.UnfurlMode.always}
        />
        <Kb.RadioButton
          key="rbwhitelist"
          label="Only for some websites"
          onSelect={() => setSelected(T.RPCChat.UnfurlMode.whitelisted)}
          selected={selected === T.RPCChat.UnfurlMode.whitelisted}
        />
        {selected === T.RPCChat.UnfurlMode.whitelisted && (
          <Kb.ScrollView style={styles.whitelist}>
            {getUnfurlWhitelist(false).map((w, idx) => {
              const wlremoved = unfurlWhitelistRemoved[w]
              return (
                <Kb.Box2 direction="vertical" key={w} style={styles.whitelistInner}>
                  {idx === 0 && <Kb.Box2 direction="vertical" style={styles.whitelistOuter} />}
                  <Kb.Box2
                    fullWidth={true}
                    direction="horizontal"
                    style={Kb.Styles.collapseStyles([
                      styles.whitelistRowContainer,
                      wlremoved ? {backgroundColor: Kb.Styles.globalColors.red_20} : undefined,
                    ])}
                  >
                    <Kb.Text type="BodySemibold">{w}</Kb.Text>
                    {wlremoved ? (
                      <Kb.Text
                        type="BodyPrimaryLink"
                        style={styles.removeText}
                        onClick={() => toggleUnfurlWhitelist(w)}
                      >
                        Restore
                      </Kb.Text>
                    ) : (
                      <Kb.WithTooltip tooltip="Remove">
                        <Kb.Icon
                          onClick={() => toggleUnfurlWhitelist(w)}
                          type="iconfont-trash"
                        />
                      </Kb.WithTooltip>
                    )}
                  </Kb.Box2>
                </Kb.Box2>
              )
            })}
          </Kb.ScrollView>
        )}
        <Kb.RadioButton
          key="rbnever"
          label="Never"
          onSelect={() => setSelected(T.RPCChat.UnfurlMode.never)}
          selected={selected === T.RPCChat.UnfurlMode.never}
        />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        gap="tiny"
        style={Kb.Styles.collapseStyles([styles.innerContainer, styles.btnContainer])}
      >
        <Kb.WaitingButton
          onClick={onSave}
          label="Save"
          small={true}
          style={styles.save}
          disabled={!allowSave}
          waitingKey={C.waitingKeySettingsChatUnfurl}
        />
        {error ? (
          <Kb.Text type="BodySmall" style={styles.error}>
            {error}
          </Kb.Text>
        ) : null}
      </Kb.Box2>
    </>
  )
}

const Sound = ({allowEdit, groups, toggle}: NotificationSettingsState) => {
  const {onToggleSound, sound} = useShellState(
    C.useShallow(s => ({
      onToggleSound: s.dispatch.setNotifySound,
      sound: s.notifySound,
    }))
  )
  const showDesktopSound = !C.isMobile && !C.isLinux
  const showMobileSound = !!groups.get('sound')?.settings.length
  if (!showDesktopSound && !showMobileSound) return null
  return (
    <>
      <Kb.Divider style={styles.divider} />
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.innerContainer}>
        <Kb.Text type="Header">Sounds</Kb.Text>
        <>
          {showDesktopSound && (
            <Kb.Checkbox onCheck={onToggleSound} checked={sound} label="Play a sound for new messages" />
          )}
          {showMobileSound && (
            <Group
              allowEdit={allowEdit}
              groupName="sound"
              onToggle={toggle}
              settings={groups.get('sound')!.settings}
              unsubscribedFromAll={false}
            />
          )}
        </>
      </Kb.Box2>
    </>
  )
}

const Misc = ({allowEdit, groups, toggle}: NotificationSettingsState) => {
  const showMisc = C.isMac || C.isIOS
  if (!showMisc) return null
  return (
    <>
      <Kb.Divider style={styles.divider} />
      <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.innerContainer}>
        <Kb.Text type="Header">Misc</Kb.Text>
        <>
          {!!groups.get('misc')?.settings && (
            <Group
              allowEdit={allowEdit}
              groupName="misc"
              onToggle={toggle}
              settings={groups.get('misc')!.settings}
              unsubscribedFromAll={false}
            />
          )}
        </>
      </Kb.Box2>
    </>
  )
}

const Chat = () => {
  const notificationSettings = useNotificationSettings()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.ScrollView>
        <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.container}>
          <Security {...notificationSettings} />
          <Kb.Divider style={styles.divider} />
          <Links />
          <Sound {...notificationSettings} />
          <Misc {...notificationSettings} />
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const TeamRow = (p: {checked: boolean; isOpen: boolean; name: string; onCheck: (c: boolean) => void}) => {
  const {checked, isOpen, name, onCheck} = p
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamRowContainer}>
        <Kb.Checkbox checked={checked} onCheck={checked => onCheck(checked)} style={styles.teamCheckbox} />
        <Kb.Avatar isTeam={true} size={Kb.Styles.isMobile ? 32 : 24} teamname={name} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamText}>
            <Kb.Text type="BodySemibold" lineClamp={1}>
              {name}
            </Kb.Text>
            {isOpen && (
              <Kb.Meta title="open" style={styles.teamMeta} backgroundColor={Kb.Styles.globalColors.green} />
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  btnContainer: {alignSelf: 'flex-start'},
  checkboxIndented: Kb.Styles.platformStyles({
    isElectron: {paddingLeft: Kb.Styles.globalMargins.medium},
    isMobile: {paddingBottom: Kb.Styles.globalMargins.medium, paddingLeft: Kb.Styles.globalMargins.small},
  }),
  container: Kb.Styles.platformStyles({
    common: {
      paddingBottom: Kb.Styles.globalMargins.small,
      paddingTop: Kb.Styles.globalMargins.small,
      width: '100%',
    },
  }),
  divider: {marginBottom: Kb.Styles.globalMargins.small},
  error: {color: Kb.Styles.globalColors.redDark},
  innerContainer: Kb.Styles.platformStyles({
    common: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
    isElectron: {
      maxWidth: 600,
    },
  }),
  removeText: {color: Kb.Styles.globalColors.black},
  save: {
    marginBottom: Kb.Styles.globalMargins.small,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  teamCheckbox: Kb.Styles.platformStyles({
    isElectron: {alignSelf: 'center', marginRight: Kb.Styles.globalMargins.tiny},
    isMobile: {marginRight: Kb.Styles.globalMargins.medium},
  }),
  teamMeta: {
    alignSelf: 'center',
    marginLeft: Kb.Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  teamNameContainer: {
    alignSelf: 'center',
    flexShrink: 1,
    marginLeft: Kb.Styles.globalMargins.tiny,
    marginRight: Kb.Styles.globalMargins.small,
  },
  teamRowContainer: {
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.isMobile ? Kb.Styles.globalMargins.large : 48,
    paddingRight: Kb.Styles.globalMargins.small,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  teamText: {
    alignSelf: 'flex-start',
  },
  whitelist: Kb.Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      backgroundColor: Kb.Styles.globalColors.blueGrey,
      marginBottom: Kb.Styles.globalMargins.xtiny,
      marginLeft: 22,
      marginTop: Kb.Styles.globalMargins.xtiny,
      paddingRight: Kb.Styles.globalMargins.medium,
    },
    isElectron: {
      height: 150,
      width: '100%',
    },
    isMobile: {
      width: '95%',
    },
  }),
  whitelistInner: {
    marginBottom: 1,
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  whitelistOuter: {
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  whitelistRowContainer: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      flexShrink: 0,
      height: 40,
      justifyContent: 'space-between',
      marginLeft: Kb.Styles.globalMargins.tiny,
      padding: Kb.Styles.globalMargins.tiny,
      paddingRight: Kb.Styles.globalMargins.small,
    },
  }),
}))

export default Chat
