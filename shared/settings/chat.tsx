import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
import * as React from 'react'
import Group from './group'
import {useSettingsChatState as useSettingsChatState} from '@/stores/settings-chat'
import {useSettingsNotifState} from '@/stores/settings-notifications'
import {useSettingsState} from '@/stores/settings'
import {useConfigState} from '@/stores/config'

const emptyList = new Array<string>()

const Security = () => {
  const {allowEdit, groups, notifRefresh} = useSettingsNotifState(
    C.useShallow(s => ({
      allowEdit: s.allowEdit,
      groups: s.groups,
      notifRefresh: s.dispatch.refresh,
    }))
  )
  const chatState = useSettingsChatState(
    C.useShallow(s => ({
      _contactSettingsEnabled: s.contactSettings.settings?.enabled,
      _contactSettingsIndirectFollowees: s.contactSettings.settings?.allowFolloweeDegrees === 2,
      _contactSettingsTeams: s.contactSettings.settings?.teams,
      _contactSettingsTeamsEnabled: s.contactSettings.settings?.allowGoodTeams,
      contactSettingsError: s.contactSettings.error,
      contactSettingsRefresh: s.dispatch.contactSettingsRefresh,
      contactSettingsSaved: s.dispatch.contactSettingsSaved,
    }))
  )
  const {_contactSettingsEnabled, _contactSettingsIndirectFollowees, _contactSettingsTeams} = chatState
  const {_contactSettingsTeamsEnabled, contactSettingsError, contactSettingsRefresh, contactSettingsSaved} =
    chatState
  const onContactSettingsSave = contactSettingsSaved
  const onToggle = useSettingsNotifState(s => s.dispatch.toggle)
  const _teamMeta = Teams.useTeamsState(s => s.teamMeta)
  const teamMeta = Teams.sortTeamsByName(_teamMeta)

  const [contactSettingsEnabled, setContactSettingsEnabled] = React.useState(_contactSettingsEnabled)
  const [contactSettingsIndirectFollowees, setContactSettingsIndirectFollowees] = React.useState(
    _contactSettingsIndirectFollowees
  )
  const [contactSettingsTeamsEnabled, setContactSettingsTeamsEnabled] = React.useState(
    _contactSettingsTeamsEnabled
  )

  const serverSelectedTeams = React.useMemo(
    () => new Map(_contactSettingsTeams?.map(t => [t.teamID, {enabled: t.enabled}])),
    [_contactSettingsTeams]
  )

  const _contactSettingsSelectedTeams = React.useMemo(() => {
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
  }, [teamMeta, serverSelectedTeams])

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

  const loadSettings = useSettingsState(s => s.dispatch.loadSettings)
  const onRefresh = React.useCallback(() => {
    loadSettings()
    notifRefresh()
    contactSettingsRefresh()
  }, [contactSettingsRefresh, loadSettings, notifRefresh])

  React.useEffect(() => {
    onRefresh()
  }, [onRefresh])

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
            onToggle={onToggle}
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
                onContactSettingsSave(
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
            {!!contactSettingsError && (
              <Kb.Text type="BodySmall" style={styles.error}>
                {contactSettingsError}
              </Kb.Text>
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const Links = () => {
  const {error, mode, onUnfurlSave, unfurlSettingsRefresh, whitelist} = useSettingsChatState(
    C.useShallow(s => ({
      error: s.unfurl.unfurlError,
      mode: s.unfurl.unfurlMode,
      onUnfurlSave: s.dispatch.unfurlSettingsSaved,
      unfurlSettingsRefresh: s.dispatch.unfurlSettingsRefresh,
      whitelist: s.unfurl.unfurlWhitelist ?? emptyList,
    }))
  )
  const [selected, setSelected] = React.useState(mode)
  const [unfurlWhitelistRemoved, setUnfurlWhitelistRemoved] = React.useState<{[K in string]: boolean}>({})
  const getUnfurlWhitelist = (filtered: boolean) =>
    filtered ? whitelist.filter(w => !unfurlWhitelistRemoved[w]) : whitelist
  const allowSave = mode !== selected || Object.keys(unfurlWhitelistRemoved).length > 0
  const onSave = () => {
    const next = whitelist.filter(w => {
      return !unfurlWhitelistRemoved[w]
    })
    onUnfurlSave(selected || T.RPCChat.UnfurlMode.always, next)
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
                <Kb.Box key={w} style={styles.whitelistInner}>
                  {idx === 0 && <Kb.Box style={styles.whitelistOuter} />}
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
                      <Kb.Box style={{position: 'relative'}}>
                        <Kb.WithTooltip tooltip="Remove">
                          <Kb.Icon
                            onClick={() => toggleUnfurlWhitelist(w)}
                            style={styles.removeIcon}
                            type="iconfont-trash"
                          />
                        </Kb.WithTooltip>
                      </Kb.Box>
                    )}
                  </Kb.Box2>
                </Kb.Box>
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

const Sound = () => {
  const {onToggleSound, sound} = useConfigState(
    C.useShallow(s => ({
      onToggleSound: s.dispatch.setNotifySound,
      sound: s.notifySound,
    }))
  )
  const {allowEdit, groups, onToggle} = useSettingsNotifState(
    C.useShallow(s => ({
      allowEdit: s.allowEdit,
      groups: s.groups,
      onToggle: s.dispatch.toggle,
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
              onToggle={onToggle}
              settings={groups.get('sound')!.settings}
              unsubscribedFromAll={false}
            />
          )}
        </>
      </Kb.Box2>
    </>
  )
}

const Misc = () => {
  const {allowEdit, groups, onToggle} = useSettingsNotifState(
    C.useShallow(s => ({
      allowEdit: s.allowEdit,
      groups: s.groups,
      onToggle: s.dispatch.toggle,
    }))
  )
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
              onToggle={onToggle}
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
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.ScrollView>
        <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.container}>
          <Security />
          <Kb.Divider style={styles.divider} />
          <Links />
          <Sound />
          <Misc />
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
  removeIcon: Kb.Styles.platformStyles({
    isElectron: {
      position: 'absolute',
      right: 0,
      top: 4,
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
