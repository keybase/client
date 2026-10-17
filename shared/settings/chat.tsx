import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import Group from './group'
import SettingsSectionTitle from './section-title'
import {addDomain, draftOf, hasEdits, removeDomain, unfurlSaveArgs, type UnfurlDraft, type UnfurlList} from './unfurl-lists'
import {loadSettings} from './load-settings'
import {produce} from 'immer'
import useNotificationSettings from './notifications/use-notification-settings'
import {useConfigState} from '@/stores/config'
import {useRPCLoad} from '@/util/use-rpc-load'
import {useShellState} from '@/stores/shell'
import {useTeamsList} from '@/teams/use-teams-list'

const emptyList = new Array<string>()

type ContactSettingsTeamsList = {[k in T.RPCGen.TeamID]: boolean}
type NotificationSettingsState = ReturnType<typeof useNotificationSettings>

const useContactSettings = () => {
  const saveContactSettingsRPC = C.useRPC(T.RPCGen.accountUserSetContactSettingsRpcPromise)
  const [error, setError] = React.useState('')
  const {data: settings, reload} = useRPCLoad(T.RPCGen.accountUserGetContactSettingsRpcPromise, [undefined], {
    map: s => s,
    onError: () => setError('Unable to load contact settings, please try again.'),
    onResult: () => setError(''),
    when: 'manual',
  })

  const contactSettingsRefresh = React.useCallback(() => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    reload()
  }, [reload])

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
  const saveUnfurlSettingsRPC = C.useRPC(T.RPCChat.localSaveUnfurlSettingsRpcPromise)
  const [loadError, setLoadError] = React.useState('')
  const [saveError, setSaveError] = React.useState('')
  const {data, reload, setData} = useRPCLoad(
    T.RPCChat.localGetUnfurlSettingsRpcPromise,
    [undefined, C.waitingKeySettingsChatUnfurl],
    {
      map: result => ({
        blocklist: result.blocklist ?? emptyList,
        mode: result.mode,
        whitelist: result.whitelist ?? emptyList,
      }),
      onError: () => setLoadError('Unable to load link preview settings, please try again.'),
      onResult: () => setLoadError(''),
      when: 'manual',
    }
  )
  const loaded = data !== undefined
  const error = saveError || loadError
  const mode = data?.mode
  const whitelist = data?.whitelist ?? emptyList
  const blocklist = data?.blocklist ?? emptyList

  const unfurlSettingsRefresh = React.useCallback(() => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    reload()
  }, [reload])

  const unfurlSettingsSaved = React.useCallback(
    (settings: ReturnType<typeof unfurlSaveArgs>, onSuccess: () => void) => {
      setSaveError('')
      if (!useConfigState.getState().loggedIn) {
        return
      }
      saveUnfurlSettingsRPC(
        [settings, C.waitingKeySettingsChatUnfurl],
        () => {
          // show what was saved until the refresh brings back the service's normalized form
          setData(settings)
          onSuccess()
          unfurlSettingsRefresh()
        },
        e => {
          setSaveError(
            e.desc
              ? `Unable to save link preview settings: ${e.desc}`
              : 'Unable to save link preview settings, please try again.'
          )
        }
      )
    },
    [saveUnfurlSettingsRPC, setData, unfurlSettingsRefresh]
  )

  return {blocklist, error, loaded, mode, unfurlSettingsRefresh, unfurlSettingsSaved, whitelist}
}

const useCompressPreference = () => {
  const [error, setError] = React.useState('')
  const {
    data: compress,
    reload,
    setData,
  } = useRPCLoad(T.RPCGen.incomingShareGetPreferenceRpcPromise, [undefined], {
    map: pref => pref.compressPreference !== T.RPCGen.IncomingShareCompressPreference.original,
    onError: () => setError('Unable to load the attachment setting, please try again.'),
    onResult: () => setError(''),
  })
  const setPreferenceRPC = C.useRPC(T.RPCGen.incomingShareSetPreferenceRpcPromise)

  const compressSaved = React.useCallback(
    (next: boolean) => {
      const prev = compress
      setError('')
      // optimistic, the post-save reload has the final say
      setData(next)
      setPreferenceRPC(
        [
          {
            preference: {
              compressPreference: next
                ? T.RPCGen.IncomingShareCompressPreference.compressed
                : T.RPCGen.IncomingShareCompressPreference.original,
            },
          },
        ],
        () => {
          reload()
        },
        () => {
          // don't reload here: its onResult would clear the error we're about to show
          setData(prev)
          setError('Unable to save the attachment setting, please try again.')
        }
      )
    },
    [compress, reload, setData, setPreferenceRPC]
  )

  return {compress, compressSaved, error}
}

const Attachments = () => {
  const styles = useStyles()
  const {compress, compressSaved, error} = useCompressPreference()
  return (
    <>
      <Kb.Divider style={styles.divider} />
      <SettingsSectionTitle
        title="Photos and videos"
        description="Applies both when you share into Keybase from another app and when you attach in a chat. Full size sends the original file, including its metadata such as location."
        style={styles.innerContainer}
      />
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        gap="xtiny"
        gapStart={true}
        style={styles.innerContainer}
      >
        <Kb.RadioButton
          label="Compress"
          onSelect={() => compressSaved(true)}
          selected={compress === true}
          disabled={compress === undefined}
        />
        <Kb.RadioButton
          label="Keep full size"
          onSelect={() => compressSaved(false)}
          selected={compress === false}
          disabled={compress === undefined}
        />
        {!!error && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {error}
          </Kb.Text>
        )}
      </Kb.Box2>
    </>
  )
}

const Security = ({allowEdit, groups, refresh, toggle}: NotificationSettingsState) => {
  const styles = useStyles()
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

  const hasInitialSelectedTeams = Object.keys(_contactSettingsSelectedTeams).length > 0
  const hasLocalSelectedTeams = Object.keys(contactSettingsSelectedTeams).length > 0
  if (hasInitialSelectedTeams && !hasLocalSelectedTeams) {
    setContactSettingsSelectedTeams(_contactSettingsSelectedTeams)
  }

  // load once per mount. Not keyed on the refresh fns: their identities change with
  // every load result (compiler memo groups them with the loaded data), which turned
  // this effect into an infinite reload loop
  const loadOnMount = React.useEffectEvent(() => {
    loadSettings()
    refresh()
    contactSettingsRefresh()
  })
  React.useEffect(() => {
    loadOnMount()
  }, [])

  return (
    <>
      <SettingsSectionTitle title="Security" style={styles.innerContainer} />

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

        <Kb.Box2 direction="vertical">
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
                gap={isMobile ? 'small' : undefined}
                gapStart={isMobile}
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
                  gap={isMobile ? 'small' : undefined}
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
                        setContactSettingsSelectedTeams(
                          produce(draft => {
                            draft[teamMeta.id] = checked
                          })
                        )
                      }
                    />
                  ))}
                </Kb.Box2>
              )}
            </>
          )}
          <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} alignSelf="flex-start">
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

type DomainListProps = {
  disabled: boolean
  domains: ReadonlyArray<string>
  heading: string
  onAdd: (domain: string) => void
  onRemove: (domain: string) => void
  removed: ReadonlySet<string>
  testID: string
}

const DomainList = (p: DomainListProps) => {
  const {disabled, domains, heading, onAdd, onRemove, removed, testID} = p
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const [text, setText] = React.useState('')
  const submit = () => {
    onAdd(text)
    setText('')
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.listSection} testID={testID}>
      <Kb.Text type="BodySmallSemibold">{heading}</Kb.Text>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="center">
        <Kb.Input3
          containerStyle={styles.listInput}
          placeholder="Add a website, e.g. example.com"
          value={text}
          onChangeText={setText}
          disabled={disabled}
          onEnterKeyDown={disabled ? undefined : submit}
        />
        <Kb.Button label="Add" small={true} onClick={submit} disabled={disabled || !text.trim()} />
      </Kb.Box2>
      {domains.length > 0 && (
        <Kb.ScrollView style={styles.list}>
          <Kb.Box2 alignSelf="center" direction="vertical" style={styles.listOuter} />
          {domains.map(domain => {
            const isRemoved = removed.has(domain)
            const onClick = disabled ? undefined : () => onRemove(domain)
            return (
              <Kb.Box2
                key={domain}
                alignSelf="center"
                direction="horizontal"
                justifyContent="space-between"
                noShrink={true}
                style={Kb.Styles.collapseStyles([
                  styles.listRowContainer,
                  isRemoved ? {backgroundColor: theme.red_20} : undefined,
                ])}
              >
                <Kb.Text type="BodySemibold">{domain}</Kb.Text>
                {isRemoved ? (
                  <Kb.Text type="BodyPrimaryLink" style={styles.removeText} onClick={onClick}>
                    Restore
                  </Kb.Text>
                ) : (
                  <Kb.WithTooltip tooltip="Remove">
                    <Kb.Icon onClick={onClick} type="iconfont-trash" />
                  </Kb.WithTooltip>
                )}
              </Kb.Box2>
            )
          })}
        </Kb.ScrollView>
      )}
    </Kb.Box2>
  )
}

export const Links = () => {
  const styles = useStyles()
  const {blocklist, error, loaded, mode, unfurlSettingsRefresh, unfurlSettingsSaved, whitelist} =
    useUnfurlSettings()
  const [selected, setSelected] = React.useState(mode)
  const [draft, setDraft] = React.useState<UnfurlDraft>()
  const saved = {blocklist, whitelist}
  const lists = draft ?? draftOf(saved)
  // a save's success clears the draft, so nothing may change while one is in flight
  const saving = C.Waiting.useAnyWaiting(C.waitingKeySettingsChatUnfurl)
  const editable = loaded && !saving
  const allowSave = loaded && (mode !== selected || hasEdits(lists, saved))
  const onSave = () => {
    unfurlSettingsSaved(unfurlSaveArgs(selected, lists), () => setDraft(undefined))
  }
  const onAdd = (list: UnfurlList) => (domain: string) =>
    setDraft(d => addDomain(d ?? draftOf(saved), list, domain))
  const onRemove = (list: UnfurlList) => (domain: string) =>
    setDraft(d => removeDomain(d ?? draftOf(saved), saved, list, domain))

  // not keyed on unfurlSettingsRefresh: its identity changes with every load result
  const refreshOnMount = React.useEffectEvent(() => {
    unfurlSettingsRefresh()
  })
  React.useEffect(() => {
    refreshOnMount()
  }, [])

  const lastModeRef = React.useRef(mode)
  React.useEffect(() => {
    if (lastModeRef.current !== mode) {
      lastModeRef.current = mode
      setSelected(mode)
    }
  }, [mode])

  return (
    <>
      <SettingsSectionTitle
        title="Link previews"
        description="Your Keybase app will visit the links you share and automatically post previews."
        style={styles.innerContainer}
      />
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        gap="xtiny"
        gapStart={true}
        style={styles.innerContainer}
      >
        <Kb.RadioButton
          key="rbalways"
          label="Allow all"
          disabled={saving}
          onSelect={() => setSelected(T.RPCChat.UnfurlMode.always)}
          selected={selected === T.RPCChat.UnfurlMode.always}
        />
        <Kb.RadioButton
          key="rbwhitelist"
          label="Ask per domain"
          disabled={saving}
          onSelect={() => setSelected(T.RPCChat.UnfurlMode.whitelisted)}
          selected={selected === T.RPCChat.UnfurlMode.whitelisted}
        />
        {selected === T.RPCChat.UnfurlMode.whitelisted && (
          <>
            <DomainList
              disabled={!editable}
              domains={lists.whitelist}
              heading="Allowed websites"
              onAdd={onAdd('allow')}
              onRemove={onRemove('allow')}
              removed={lists.removed}
              testID={TestIDs.SETTINGS_UNFURL_ALLOWED}
            />
            <DomainList
              disabled={!editable}
              domains={lists.blocklist}
              heading="Blocked websites"
              onAdd={onAdd('block')}
              onRemove={onRemove('block')}
              removed={lists.removed}
              testID={TestIDs.SETTINGS_UNFURL_BLOCKED}
            />
          </>
        )}
        <Kb.RadioButton
          key="rbnever"
          label="Disallow all"
          disabled={saving}
          onSelect={() => setSelected(T.RPCChat.UnfurlMode.never)}
          selected={selected === T.RPCChat.UnfurlMode.never}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" gap="tiny" alignSelf="flex-start" style={styles.innerContainer}>
        <Kb.WaitingButton
          onClick={onSave}
          label="Save"
          small={true}
          style={styles.save}
          disabled={!allowSave}
          waitingKey={C.waitingKeySettingsChatUnfurl}
          testID={TestIDs.SETTINGS_UNFURL_SAVE}
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
  const styles = useStyles()
  const {onToggleSound, sound} = useShellState(
    C.useShallow(s => ({
      onToggleSound: s.dispatch.setNotifySound,
      sound: s.notifySound,
    }))
  )
  const showDesktopSound = !isMobile && !C.isLinux
  const showMobileSound = !!groups.get('sound')?.settings.length
  if (!showDesktopSound && !showMobileSound) return null
  return (
    <>
      <Kb.Divider style={styles.divider} />
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.innerContainer}>
        <Kb.Text type="Header">Sounds</Kb.Text>
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
      </Kb.Box2>
    </>
  )
}

const Misc = ({allowEdit, groups, toggle}: NotificationSettingsState) => {
  const styles = useStyles()
  const showMisc = C.isMac || isIOS
  if (!showMisc) return null
  return (
    <>
      <Kb.Divider style={styles.divider} />
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.innerContainer}>
        <Kb.Text type="Header">Misc</Kb.Text>
        {!!groups.get('misc')?.settings && (
          <Group
            allowEdit={allowEdit}
            groupName="misc"
            onToggle={toggle}
            settings={groups.get('misc')!.settings}
            unsubscribedFromAll={false}
          />
        )}
      </Kb.Box2>
    </>
  )
}

const Chat = () => {
  const styles = useStyles()
  const notificationSettings = useNotificationSettings()
  return (
    <Kb.ScrollView testID={TestIDs.SETTINGS_CHAT}>
      {/* fullHeight would cap the ScrollView's contentSize at the viewport, cutting off scrolling */}
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.container}>
        <Security {...notificationSettings} />
        <Kb.Divider style={styles.divider} />
        <Links />
        {/* iOS is the only platform that processes attachments before sending */}
        {isIOS && <Attachments />}
        <Sound {...notificationSettings} />
        <Misc {...notificationSettings} />
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const TeamRow = (p: {checked: boolean; isOpen: boolean; name: string; onCheck: (c: boolean) => void}) => {
  const styles = useStyles()
  const {checked, isOpen, name, onCheck} = p
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamRowContainer}>
      <Kb.Checkbox checked={checked} onCheck={checked => onCheck(checked)} style={styles.teamCheckbox} />
      <Kb.Avatar isTeam={true} size={isMobile ? 32 : 24} teamname={name} />
      <Kb.Box2 direction="horizontal" fullWidth={true} alignSelf="center" style={styles.teamNameContainer}>
        <Kb.Text type="BodySemibold" lineClamp={1}>
          {name}
        </Kb.Text>
        {isOpen && <Kb.Meta variant="open" style={styles.teamMeta} />}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  checkboxIndented: Kb.Styles.platformStyles({
    isElectron: {paddingLeft: Kb.Styles.globalMargins.medium},
    isMobile: {paddingBottom: Kb.Styles.globalMargins.medium, paddingLeft: Kb.Styles.globalMargins.small},
  }),
  container: {
    ...Kb.Styles.paddingV(Kb.Styles.globalMargins.small),
  },
  divider: {marginBottom: Kb.Styles.globalMargins.small},
  error: {color: theme.redDark},
  innerContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    },
    isElectron: {
      maxWidth: 600,
    },
  }),
  removeText: {color: theme.black},
  save: {
    marginBottom: Kb.Styles.globalMargins.small,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  teamCheckbox: Kb.Styles.platformStyles({
    isElectron: {alignSelf: 'center', marginRight: Kb.Styles.globalMargins.tiny},
    isMobile: {marginRight: Kb.Styles.globalMargins.medium},
  }),
  teamMeta: {
    marginLeft: Kb.Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  teamNameContainer: {
    flexShrink: 1,
    marginLeft: Kb.Styles.globalMargins.tiny,
    marginRight: Kb.Styles.globalMargins.small,
  },
  teamRowContainer: {
    ...Kb.Styles.padding(
      Kb.Styles.globalMargins.xtiny,
      Kb.Styles.globalMargins.small,
      Kb.Styles.globalMargins.xtiny,
      isMobile ? Kb.Styles.globalMargins.large : 48
    ),
  },
  list: Kb.Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      backgroundColor: theme.blueGrey,
      marginBottom: Kb.Styles.globalMargins.xtiny,
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
  listInput: {flexGrow: 1, flexShrink: 1},
  listOuter: {
    ...Kb.Styles.marginV(Kb.Styles.globalMargins.tiny),
  },
  listRowContainer: {
    backgroundColor: theme.white,
    height: 40,
    marginBottom: 1,
    marginLeft: Kb.Styles.globalMargins.tiny,
    marginRight: Kb.Styles.globalMargins.tiny,
    padding: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.small,
  },
  listSection: {marginLeft: 22, marginTop: Kb.Styles.globalMargins.xtiny},
}))

export default Chat
