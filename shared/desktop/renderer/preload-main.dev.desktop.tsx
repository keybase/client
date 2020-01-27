import url from 'url'
import events from 'events'
import './preload-main.shared.desktop'
// dev only, needed by dev server

window.KB = {
  ...window.KB,
  DEV: {
    DEBUGActionLoop: undefined,
    DEBUGEffectById: undefined,
    DEBUGEngine: undefined,
    DEBUGLoaded: undefined,
    DEBUGLogSagas: undefined,
    DEBUGLogSagasWithNames: undefined,
    DEBUGNavigator: undefined,
    DEBUGRootEffects: undefined,
    DEBUGSagaMiddleware: undefined,
    DEBUGStore: undefined,
    events,
    url,
  },
}
