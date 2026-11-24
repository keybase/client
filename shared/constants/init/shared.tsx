import type * as EngineGen from "@/constants/rpc";
import * as T from "../types";
import isEqual from "lodash/isEqual";
import logger from "@/logger";
import * as Tabs from "@/constants/tabs";
declare global {
  var __hmr_sharedUnsubs: Array<() => void> | undefined;

  var __hmr_platformUnsubs: Array<() => void> | undefined;

  var __hmr_oneTimeInitDone: boolean | undefined;

  var __hmr_TBstores: Map<unknown, unknown> | undefined;
}
import { useBlockButtonsState } from "@/chat/blocking/block-buttons-state";
import { useNotifState } from "@/stores/notifications";
import { notifyEngineActionListeners } from "@/engine/action-listener";
import { serviceStaticConfigToStaticConfig } from "@/constants/chat/static-config";
import { emitDeepLink } from "@/router-v2/linking";
import { enqueuePushTapRoute } from "@/router-v2/deep-link-emitter";
import { ignorePromise, timeoutPromise } from "../utils";
import { isPhone, serverConfigFileName } from "../platform";
import { useAvatarState } from "@/common-adapters/avatar/store";
import { useInboxLayoutState } from "@/chat/inbox/layout-state";
import { useConfigState } from "@/stores/config";
import { useCurrentUserState } from "@/stores/current-user";
import {
  setPushTapAck,
  useNavigationIntentsState,
} from "@/stores/navigation-intents";
import { useDaemonState, type BootstrapStep } from "@/stores/daemon";
import { useDarkModeState } from "@/stores/darkmode";
import { useFollowerState } from "@/stores/followers";
import { useShellState } from "@/stores/shell";
import { useSettingsEmailState } from "@/stores/settings-email";
import { useSettingsPhoneState } from "@/stores/settings-phone";
import { useSettingsContactsState } from "@/stores/settings-contacts";
import { useUsersState } from "@/stores/users";
import { useRouterState } from "@/stores/router";
import * as NavTree from "@/constants/nav-tree";
import {
  isChatNotification,
  isChatNotificationNotForSignedInAccount,
  routeChatNotification,
} from "@/chat/notification-router";
import { onChatRouteChanged } from "@/chat/inbox/metadata";
import { watchChatSelection } from "@/chat/inbox/selection";
import { watchChatLayout } from "@/chat/layout-watch";
import { syncInboxBadgeState } from "@/chat/inbox/badge-state";
import { clearSignupEmail } from "@/people/signup-email";
import { clearSignupDeviceNameDraft } from "@/signup/device-name-draft";
import { clearNavBadges } from "@/teams/actions";
import {
  ackPushTap,
  addAppLifecycleListener,
  addPushTapListener,
  getAppLifecycleState,
  peekPushTap,
  type AppLifecycleState,
} from "react-native-kb";
import {
  parsePushTapPayload,
  pushTapField,
  resolvePushTap,
  type PushTapPayload,
} from "./push-tap-resolve";

const _sharedUnsubs: Array<() => void> = __DEV__
  ? (globalThis.__hmr_sharedUnsubs ??= [])
  : [];

type SubscribeStore<State> = {
  subscribe: (
    listener: (state: State, previousState: State) => void,
  ) => () => void;
};

const subscribeValue = <State, Value>(
  store: SubscribeStore<State>,
  select: (state: State) => Value,
  onChange: (value: Value, previous: Value) => void,
) =>
  store.subscribe((state, previousState) => {
    const value = select(state);
    const previous = select(previousState);
    if (value !== previous) {
      onChange(value, previous);
    }
  });

type ConfigState = ReturnType<typeof useConfigState.getState>;
type DaemonState = ReturnType<typeof useDaemonState.getState>;
type RouterState = ReturnType<typeof useRouterState.getState>;

// ─── Bootstrap steps ──────────────────────────────────────────────────────────
// Gating steps for the daemon handshake, run by useDaemonState.dispatch.startHandshake after
// bootstrapStatus loads. Throwing fails the attempt and triggers a retry.

const loadDarkPrefsStep = async () => {
  useDarkModeState.getState().dispatch.loadDarkPrefs();
  return Promise.resolve();
};

const loadChatStaticConfigStep = async () => {
  const { chatBuiltinCommands, chatDeletableByDeleteHistory } =
    useConfigState.getState();
  if (chatBuiltinCommands && chatDeletableByDeleteHistory) {
    return;
  }
  const staticConfig = serviceStaticConfigToStaticConfig(
    await T.RPCChat.localGetStaticConfigRpcPromise(),
  );
  if (!staticConfig) {
    logger.error("chat.loadStaticConfig: missing required static config");
    return;
  }
  useConfigState.getState().dispatch.setChatStaticConfig(staticConfig);
};

// The service sends a notification only to a connection subscribed to its channel, so every
// handshake subscribes before it reads anything.
const subscribeNotificationsStep = async () => {
  try {
    // prettier-ignore
    await T.RPCGen.notifyCtlSetNotificationsRpcPromise({
      channels: {
        allowChatNotifySkips: true, app: true, audit: true, badges: true, chat: true, chatarchive: true,
        chatattachments: true, chatdev: false, chatemoji: false, chatemojicross: false, chatkbfsedits: false,
        deviceclone: false, ephemeral: false, favorites: false, featuredBots: false, kbfs: true, kbfsdesktop: !isMobile,
        devicehistory: true, kbfslegacy: false, kbfsrequest: false, kbfssubscription: true, keyfamily: false, notifysimplefs: true,
        paperkeys: false, pgp: true, reachability: false, runtimestats: false, saltpack: true, service: true, session: true,
        team: true, teamChanged: true, teambot: false, tracking: true, users: true, wallet: false,
      },
    })
  } catch (error) {
    logger.warn("error in toggling notifications: ", error);
  }
};

export const loadAccountsStep = async () => {
  const refreshAccounts = useConfigState.getState().dispatch.refreshAccounts;
  // refreshAccounts is local (config/keychain + offline uidmap). Handshake must
  // not await it while logged in or switching; the logged-out picker still
  // awaits so the list is not empty.
  if (
    useDaemonState.getState().bootstrapStatus?.loggedIn ||
    useConfigState.getState().userSwitching
  ) {
    ignorePromise(refreshAccounts().catch(() => {}));
    return;
  }
  try {
    await refreshAccounts();
  } catch {
    throw new Error("Can't get accounts");
  }
};

const requestFollowerInfoForStartup = () => {
  const { uid } = useCurrentUserState.getState();
  logger.info(`getFollowerInfo: init; uid=${uid}`);
  if (uid) {
    // request follower info in the background
    T.RPCGen.configRequestFollowingAndUnverifiedFollowersRpcPromise()
      .then(() => {})
      .catch(() => {});
  }
};

const updateServerConfigForStartup = async () => {
  if (useConfigState.getState().loggedIn) {
    try {
      await T.RPCGen.configUpdateLastLoggedInAndServerConfigRpcPromise({
        serverConfigPath: serverConfigFileName,
      });
    } catch {}
  }
};

const loadStartupSettings = () => {
  useSettingsContactsState.getState().dispatch.loadContactImportEnabled();
};

const refreshStartupChat = () => {
  // On phone, let the focused inbox screen trigger the first refresh so hidden chatRoot
  // mounts behind a pushed conversation do not pay inbox startup cost.
  if (!isPhone && useCurrentUserState.getState().username) {
    ignorePromise(useInboxLayoutState.getState().dispatch.refresh("bootstrap"));
  }
};

// Loads that want a logged-in user but shouldn't compete with first paint
const scheduleStartupOrReloginWork = () => {
  const f = async () => {
    await timeoutPromise(1000);
    requestAnimationFrame(() => {
      requestFollowerInfoForStartup();
      ignorePromise(updateServerConfigForStartup());
      loadStartupSettings();
      refreshStartupChat();
    });
  };
  ignorePromise(f());
};

// After an offline stretch, reread the session to pick up what the service learned while we could
// not reach it. `previous === undefined` is the first reading of the network at startup, which the
// handshake's own read already covers.
export const onNetworkOnlineChanged = (
  online?: boolean,
  previous?: boolean,
) => {
  if (!online || previous !== false) {
    return;
  }
  if (
    useDaemonState.getState().handshakeState === "done" &&
    !useConfigState.getState().userSwitching
  ) {
    useDaemonState.getState().dispatch.refreshSessionFromDaemon("back online");
  }
};

const onLoggedInChanged = (loggedIn: ConfigState["loggedIn"]) => {
  if (loggedIn) {
    scheduleStartupOrReloginWork();
  } else {
    clearSignupEmail();
    clearSignupDeviceNameDraft();
    useBlockButtonsState.getState().dispatch.resetState();
  }
  ignorePromise(useConfigState.getState().dispatch.refreshAccounts());
};

const onRevokedTriggerChanged = () => {
  ignorePromise(useConfigState.getState().dispatch.refreshAccounts());
};

const onConfiguredAccountsChanged = (
  configuredAccounts: ConfigState["configuredAccounts"],
) => {
  const updates = configuredAccounts.map((account) => ({
    info: { fullname: account.fullname ?? "" },
    name: account.username,
  }));
  if (updates.length > 0) {
    useUsersState.getState().dispatch.updates(updates);
  }
};

const onBootstrapStatusChanged = (
  bootstrap: DaemonState["bootstrapStatus"],
) => {
  if (!bootstrap) {
    return;
  }

  const { deviceID, deviceName, loggedIn, uid, username } = bootstrap;

  const {
    dispatch: configDispatch,
    userSwitching,
    userSwitchingTo,
  } = useConfigState.getState();
  // Mid-switch, only the target's session applies: not the switch's own logout, nor the account
  // being left (sent before that logout). onUserSwitchingChanged applies the latest status once the
  // switch ends.
  if (userSwitching && (!loggedIn || username !== userSwitchingTo)) {
    logger.info(
      "[Bootstrap] ignoring a status other than the switch target's during account switch",
    );
    return;
  }

  // Logged in as someone else than the user we hold is a logout and then a login. The service reads
  // the session when it sends it, so the status sent for the logout can already be the next login.
  // Log the previous account out of our stores first. Read the held uid before anything below
  // writes the current user.
  const currentUid = useCurrentUserState.getState().uid;
  if (
    loggedIn &&
    useConfigState.getState().loggedIn &&
    currentUid &&
    uid !== currentUid
  ) {
    logger.info(
      "[Bootstrap] the session is another user now, logging out the previous one",
    );
    configDispatch.setLoggedIn(false);
  }

  useCurrentUserState
    .getState()
    .dispatch.setBootstrap({ deviceID, deviceName, uid, username });
  if (username) {
    configDispatch.setDefaultUsername(username);
  }
  configDispatch.setLoggedIn(loggedIn);

  if (bootstrap.httpSrvInfo) {
    configDispatch.setHTTPSrvInfo(
      bootstrap.httpSrvInfo.address,
      bootstrap.httpSrvInfo.token,
    );
  }
};

// Mid-switch only the target's status applies, and a switch that fails before the service changes
// the session gets no status at all, so the latest one applies once the switch ends.
const onUserSwitchingChanged = (
  userSwitching: ConfigState["userSwitching"],
) => {
  if (!userSwitching) {
    onBootstrapStatusChanged(useDaemonState.getState().bootstrapStatus);
  }
};

// Native reports the app state from the same callbacks that report it to Go, and this is the only
// writer of mobileAppState. Desktop has no lifecycle; its window focus goes straight to appFocused.
export const applyMobileAppState = (state: AppLifecycleState) => {
  if (!isMobile) return;
  useShellState.getState().dispatch.setMobileAppState(state);
};

const isMobileAppState = (s: string): s is AppLifecycleState =>
  s === "active" || s === "inactive" || s === "background";

const onNativeAppLifecycle = (state: string) => {
  logger.info(`[AppState] native: ${state}`);
  if (isMobileAppState(state)) {
    applyMobileAppState(state);
  } else {
    logger.warn(
      `[AppState] unmapped state ${state}, leaving the app state as it was`,
    );
  }
};

// Subscribe before seeding: events emitted while no listener existed are only in the seed, and one
// emitted after the seed read reaches the listener later on this thread.
export const listenForAppLifecycle = (): (() => void) => {
  const stop = addAppLifecycleListener(onNativeAppLifecycle);
  const initial: string = getAppLifecycleState();
  if (isMobileAppState(initial)) {
    applyMobileAppState(initial);
  }
  return stop;
};

const membersTypeOf = (
  t: string,
): T.RPCChat.ConversationMembersType | undefined => {
  switch (parseInt(t, 10)) {
    case T.RPCChat.ConversationMembersType.kbfs:
      return T.RPCChat.ConversationMembersType.kbfs;
    case T.RPCChat.ConversationMembersType.team:
      return T.RPCChat.ConversationMembersType.team;
    case T.RPCChat.ConversationMembersType.impteamnative:
      return T.RPCChat.ConversationMembersType.impteamnative;
    case T.RPCChat.ConversationMembersType.impteamupgrade:
      return T.RPCChat.ConversationMembersType.impteamupgrade;
    default:
      return undefined;
  }
};

// An Android push is a data message Go displayed itself, so a tapped chat push's message is unboxed
// into the thread here. It waits for the account the push names, which after a cold tap or an
// account switch is not current yet, and only as long as its tap is still queued: a tap that is
// dropped (expired, superseded, its switch failed, logged out) never unboxes later.
let pendingPushTapUnbox:
  | {
      params: {
        convID: string;
        membersType: T.RPCChat.ConversationMembersType;
        payload: string;
      };
      tapID: number;
      uid: string;
    }
  | undefined;

const settlePushTapUnbox = () => {
  const pending = pendingPushTapUnbox;
  if (!pending) return;
  const { uid } = useCurrentUserState.getState();
  if (uid && (!pending.uid || pending.uid === uid)) {
    pendingPushTapUnbox = undefined;
    T.RPCChat.localUnboxMobilePushNotificationRpcPromise(pending.params).catch(
      () => {
        logger.info("[PushTap] failed to unbox message from payload");
      },
    );
    return;
  }
  // Checked after the account: a consumed tap leaves the queue as its account becomes current.
  if (
    useNavigationIntentsState.getState().intent?.pushTapID !== pending.tapID
  ) {
    pendingPushTapUnbox = undefined;
  }
};

const queuePushTapUnbox = (tapID: number, payload: PushTapPayload) => {
  const get = (key: string) => pushTapField(payload, key);
  const convID = get("convID");
  const boxed = get("m");
  const membersType = membersTypeOf(get("t"));
  if (
    get("type") !== "chat.newmessage" ||
    !convID ||
    !boxed ||
    membersType === undefined
  )
    return;
  pendingPushTapUnbox = {
    params: { convID, membersType, payload: boxed },
    tapID,
    uid: get("uid"),
  };
  settlePushTapUnbox();
};

// Native holds a tapped notification until it is acked by id, so a peek never loses one: the
// same tap peeked again (a repeated event, a JS reload) carries the same id, which the intent
// store turns away. A tap that opens nothing is acked here; one that does is acked by whatever
// consumes or drops its intent.
let lastTakenPushTapID: number | undefined;
const takePushTap = () => {
  const tap = peekPushTap();
  if (!tap) return;
  const payload = parsePushTapPayload(tap.payload);
  const route = payload && resolvePushTap(payload);
  if (!payload || !route) {
    logger.info("[PushTap] a tap with no route, only opening the app");
    ackPushTap(tap.id);
    return;
  }
  const firstTake = lastTakenPushTapID !== tap.id;
  lastTakenPushTapID = tap.id;
  enqueuePushTapRoute({
    id: tap.id,
    targetUid: route.targetUid,
    url: route.url,
  });
  if (firstTake && isAndroid) {
    queuePushTapUnbox(tap.id, payload);
  }
};

// Subscribe before peeking: a tap held before JS listened is only seen by the peek, and one that
// lands after the peek reaches the listener.
export const listenForPushTaps = (): (() => void) => {
  setPushTapAck(ackPushTap);
  const stopTaps = addPushTapListener(takePushTap);
  const stopUnboxOnAccount = useCurrentUserState.subscribe(settlePushTapUnbox);
  const stopUnboxOnIntent =
    useNavigationIntentsState.subscribe(settlePushTapUnbox);
  takePushTap();
  return () => {
    stopTaps();
    stopUnboxOnAccount();
    stopUnboxOnIntent();
  };
};

const onNavStateChanged = (
  next: RouterState["navState"],
  prev: RouterState["navState"],
) => {
  if (prev === next) return;

  // Clear critical update when we nav away from tab
  if (
    prev &&
    NavTree.currentTab(prev) === Tabs.fsTab &&
    next &&
    NavTree.currentTab(next) !== Tabs.fsTab &&
    useShellState.getState().fsCriticalUpdate
  ) {
    const { dispatch } = useShellState.getState();
    dispatch.setFsCriticalUpdate(false);
  }

  if (
    prev &&
    NavTree.currentTab(prev) === Tabs.teamsTab &&
    next &&
    NavTree.currentTab(next) !== Tabs.teamsTab
  ) {
    clearNavBadges();
  }

  onChatRouteChanged(prev, next);
};

export const onEngineConnected = () => {
  {
    const registerUIs = async () => {
      try {
        await T.RPCGen.delegateUiCtlRegisterChatUIRpcPromise();
        await T.RPCGen.delegateUiCtlRegisterLogUIRpcPromise();
        logger.info("Registered Chat UI");
        await T.RPCGen.delegateUiCtlRegisterHomeUIRpcPromise();
        logger.info("Registered home UI");
        await T.RPCGen.delegateUiCtlRegisterSecretUIRpcPromise();
        logger.info("Registered secret ui");
        await T.RPCGen.delegateUiCtlRegisterIdentify3UIRpcPromise();
        logger.info("Registered identify ui");
        await T.RPCGen.delegateUiCtlRegisterRekeyUIRpcPromise();
        logger.info("Registered rekey ui");
      } catch (error) {
        logger.error("Error in registering UIs:", error);
      }
    };
    ignorePromise(registerUIs());
  }
  useConfigState.getState().dispatch.onEngineConnected();
  useDaemonState.getState().dispatch.startHandshake();
};

export const onEngineDisconnected = () => {
  const f = async () => {
    await logger.dump();
  };
  ignorePromise(f());
  useDaemonState.getState().dispatch.setError(new Error("Disconnected"));
};

export const initSharedSubscriptions = (
  platformBootstrapSteps: Array<BootstrapStep> = [],
) => {
  useDaemonState
    .getState()
    .dispatch.initBootstrapSteps([
      loadDarkPrefsStep,
      loadChatStaticConfigStep,
      loadAccountsStep,
      ...platformBootstrapSteps,
    ], subscribeNotificationsStep);

  // HMR cleanup: unsubscribe old store subscriptions before re-subscribing
  for (const unsub of _sharedUnsubs) unsub();
  _sharedUnsubs.length = 0;
  _sharedUnsubs.push(
    subscribeValue(useConfigState, (s) => s.loggedIn, onLoggedInChanged),
    subscribeValue(
      useConfigState,
      (s) => s.revokedTrigger,
      onRevokedTriggerChanged,
    ),
    subscribeValue(
      useConfigState,
      (s) => s.configuredAccounts,
      onConfiguredAccountsChanged,
    ),
    subscribeValue(
      useConfigState,
      (s) => s.userSwitching,
      onUserSwitchingChanged,
    ),
  );

  _sharedUnsubs.push(
    subscribeValue(
      useDaemonState,
      (s) => s.bootstrapStatus,
      onBootstrapStatusChanged,
    ),
  );
  _sharedUnsubs.push(watchChatSelection());
  _sharedUnsubs.push(watchChatLayout());
  _sharedUnsubs.push(
    subscribeValue(
      useShellState,
      (s) => s.networkStatus?.online,
      onNetworkOnlineChanged,
    ),
  );

  _sharedUnsubs.push(
    subscribeValue(useRouterState, (s) => s.navState, onNavStateChanged),
  );
};

// Prefs read just before an account switch can arrive after it. Without a current uid they're
// kept: the login push can arrive before the GUI learns the new account's uid.
const isUIPrefsForAnotherAccount = (
  action: EngineGen.Actions,
  currentUID: string,
) =>
  action.type === "keybase.1.gregorUI.pushUIPrefs" &&
  !!currentUID &&
  !!action.payload.params.uid &&
  action.payload.params.uid !== currentUID;

// This is to defer loading stores we don't need immediately.
export const _onEngineIncoming = (action: EngineGen.Actions) => {
  const currentUID = useCurrentUserState.getState().uid;
  if (
    isChatNotificationNotForSignedInAccount(action, currentUID) ||
    isUIPrefsForAnotherAccount(action, currentUID)
  ) {
    return;
  }
  if (isChatNotification(action)) {
    routeChatNotification(action);
  }
  switch (action.type) {
    case "keybase.1.NotifySession.sessionChanged":
      useDaemonState
        .getState()
        .dispatch.onSessionChanged(action.payload.params.status);
      break;
    case "keybase.1.NotifyBadges.badgeState":
      {
        const { badgeState } = action.payload.params;
        syncInboxBadgeState(badgeState);
        useNotifState.getState().dispatch.onEngineIncomingImpl(action);
      }
      break;
    case "keybase.1.gregorUI.pushUIPrefs": {
      const { prefs } = action.payload.params;
      useBlockButtonsState.getState().dispatch.updateFromPrefs(prefs);
      useNotifState.getState().dispatch.onEngineIncomingImpl(action);
      break;
    }
    case "keybase.1.NotifyEmailAddress.emailAddressVerified":
      useSettingsEmailState
        .getState()
        .dispatch.notifyEmailVerified(action.payload.params.emailAddress);
      clearSignupEmail();
      break;
    case "keybase.1.NotifyPhoneNumber.phoneNumbersChanged": {
      const { list } = action.payload.params;
      useSettingsPhoneState
        .getState()
        .dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined);
      break;
    }
    case "keybase.1.NotifyEmailAddress.emailsChanged": {
      const { list: maybeList, uid } = action.payload.params;
      // a list fetched for the account we just switched away from
      if (uid !== useCurrentUserState.getState().uid) {
        break;
      }
      const list = maybeList ?? [];
      useSettingsEmailState
        .getState()
        .dispatch.notifyEmailAddressEmailsChanged(list);
      break;
    }
    case "keybase.1.NotifyService.handleKeybaseLink":
      {
        const { link, deferred } = action.payload.params;
        if (deferred && !link.startsWith("keybase://team-invite-link/")) {
          return;
        }
        // Route through the linking config; it falls back to handleAppLink
        // for URL patterns not handled declaratively.
        const fullUrl = link.startsWith("keybase://")
          ? link
          : `keybase://${link}`;
        emitDeepLink(fullUrl);
      }
      break;
    case "keybase.1.NotifyTeam.avatarUpdated": {
      const { name } = action.payload.params;
      useAvatarState.getState().dispatch.updated(name);
      break;
    }
    case "keybase.1.NotifyTracking.trackingChanged": {
      const { isTracking, username } = action.payload.params;
      useFollowerState
        .getState()
        .dispatch.updateFollowing(username, isTracking);
      break;
    }
    case "keybase.1.NotifyTracking.trackingInfo": {
      const {
        uid,
        followers: _newFollowers,
        followees: _newFollowing,
      } = action.payload.params;
      if (useCurrentUserState.getState().uid !== uid) {
        break;
      }
      const newFollowers = new Set(_newFollowers);
      const newFollowing = new Set(_newFollowing);
      const {
        following: oldFollowing,
        followers: oldFollowers,
        dispatch,
      } = useFollowerState.getState();
      const following = isEqual(newFollowing, oldFollowing)
        ? oldFollowing
        : newFollowing;
      const followers = isEqual(newFollowers, oldFollowers)
        ? oldFollowers
        : newFollowers;
      dispatch.replace(followers, following);
      break;
    }
    case "keybase.1.NotifyTracking.notifyUserBlocked":
      {
        useUsersState.getState().dispatch.onEngineIncomingImpl(action);
      }
      break;
    case "keybase.1.NotifyUsers.identifyUpdate":
      {
        useUsersState.getState().dispatch.onEngineIncomingImpl(action);
      }
      break;
    default:
  }
  useConfigState.getState().dispatch.onEngineIncoming(action);
  notifyEngineActionListeners(action);
};
