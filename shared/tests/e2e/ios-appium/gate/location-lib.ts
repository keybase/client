// Framework-free parts of the chat location flow: the fixed points it moves the simulator between,
// the phone service's live-location lines (go/chat/maps/livelocation.go, ios.log), the location
// messages the host reads back, and the app-side stop the flow's afterEach sends when a test stopped
// before its own stop from the composer.

export type Point = {lat: number; lon: number}

// Apple Park, public and fixed; every point the flow sets is one of these. The moves are far enough
// apart that the service records each (in the background it waits for real movement), and FAR far
// enough for iOS to count it as a significant change.
export const APPLE_PARK: Point = {lat: 37.3349, lon: -122.009}
export const NEAR: Point = {lat: APPLE_PARK.lat + 0.01, lon: APPLE_PARK.lon}
export const NEARER: Point = {lat: APPLE_PARK.lat + 0.02, lon: APPLE_PARK.lon}
export const FAR: Point = {lat: APPLE_PARK.lat + 0.06, lon: APPLE_PARK.lon + 0.04}
export const POINTS: ReadonlyArray<Point> = [APPLE_PARK, NEAR, NEARER, FAR]

export const requireFixedPoint = (p: Point) => {
  if (!POINTS.some(q => q.lat === p.lat && q.lon === p.lon)) throw new Error('refusing a location that is not one of the fixed points')
  return p
}

export const GO_START_TRACKING = /LiveLocationTracker: StartTracking/
export const GO_STOP_ALL = /LiveLocationTracker: StopAllTracking/
// a live tracker letting go once stopped, before its last "done" post
export const GO_TRACKER_STOPPED = /tracker\[\d+\]: stopped, updating with done status/
// the stop, the tracker's, and its last "done" post, before it lets go of the watcher
export const GO_STOPPED = [GO_STOP_ALL, GO_TRACKER_STOPPED, /- LiveLocationTracker: updateMapUnfurl -> /]
// a fix handed to the service, taken by the tracker, and posted to the conversation
export const GO_MOVE_POSTED = [/\+ LiveLocationTracker: LocationUpdate/, /tracker\[\d+\]: got coords/, /\+ LiveLocationTracker: updateMapUnfurl/]
// a relaunch that brought back at least one tracker
export const GO_RESTORED = /LiveLocationTracker: restoreLocked: restored [1-9]\d* trackers/
// the app going to the background while it shares: the service stays up for the share
export const GO_BACKGROUND_SHARING = [
  /MobileAppState\.Update: useful update: INACTIVE,/,
  /AppDidEnterBackground: setting background active/,
  /MobileAppState\.Update: useful update: BACKGROUNDACTIVE,/,
]
export const WATCHER = 'KbLocationWatcher: '
const WATCHER_STARTS = 'starting location updates'
const WATCHER_STOPS = 'stopping location updates'
export const WATCHER_STOPPED = new RegExp(WATCHER_STOPS)

// Whether the native watcher's lines show it running at the end: a start with no stop after it. The
// app starts the watcher once location is granted, and a share keeps that watcher rather than
// starting another.
export const watcherRunning = (lines: ReadonlyArray<string>) => {
  const last = [...lines].reverse().find(l => l.includes(WATCHER_STARTS) || l.includes(WATCHER_STOPS))
  return !!last?.includes(WATCHER_STARTS)
}

// What the location screen's buttons send (input-area/location-popup.tsx).
export const CURRENT_LOCATION = '/location'
export const LIVE_15M = '/location live 15m'

type Message = {content: {type: string; text?: {body: string}}; sender: {username: string}}

// Whether `messages` (the host's read of the channel) hold `sender`'s location message `body`.
export const holdsLocationMessage = (messages: ReadonlyArray<Message>, sender: string, body: string) =>
  messages.some(m => m.sender.username === sender && m.content.type === 'text' && m.content.text?.body === body)

const convIDRe = /^[0-9a-f]{16,128}$/

// The app's own send of `/location stop` to `convID`, with the conversation's tlf name as the app
// holds it (so no name goes into the eval). Run it inside withHarnessRpcs.
export const stopLocationBody = (convID: string) => {
  if (!convIDRe.test(convID)) throw new Error('refusing a conversation id that is not one')
  return `const id = ${JSON.stringify(convID)};
  const meta = kbModule('chat/conversation/thread-load.tsx').getMeta(id);
  if (!meta.tlfname) throw new Error('the app holds no meta for the conversation');
  kbModule('chat/conversation/send-actions.tsx').sendTextToConversation(id, meta.tlfname, '/location stop');
  return true`
}
