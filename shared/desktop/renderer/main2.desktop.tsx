// Entry point to the chrome part of the app
import '../../util/user-timings'
import Main from '../../app/main.desktop'
// order of the above 2 must NOT change. needed for patching / hot loading to be correct
import * as NotificationsGen from '../../actions/notifications-gen'
import * as React from 'react'
import * as ConfigGen from '../../actions/config-gen'
import ReactDOM from 'react-dom'
import RemoteProxies from '../remote/proxies.desktop'
import Root from './container.desktop'
import configureStore from '../../store/configure-store'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {makeEngine} from '../../engine'
import {disable as disableDragDrop} from '../../util/drag-drop'
import flags from '../../util/feature-flags'
import {dumpLogs} from '../../actions/platform-specific/index.desktop'
import {initDesktopStyles} from '../../styles/index.desktop'
import {isDarwin} from '../../constants/platform'
import {useSelector} from '../../util/container'
import {isDarkMode} from '../../constants/config'
import {TypedActions} from '../../actions/typed-actions-gen'

// Top level HMR accept
if (module.hot) {
  module.hot.accept()
}

let _store: any

const setupStore = () => {
  let store = _store
  let runSagas: any
  if (!_store) {
    const configured = configureStore()
    store = configured.store
    runSagas = configured.runSagas

    _store = store
    if (__DEV__ && flags.admin) {
      // @ts-ignore codemode issue
      window.DEBUGStore = _store
    }
  }

  return {runSagas, store}
}

const setupApp = (store, runSagas) => {
  disableDragDrop()
  const eng = makeEngine(store.dispatch, store.getState)
  runSagas && runSagas()
  eng.sagasAreReady()

  SafeElectron.getApp().on('KBdispatchAction' as any, (_: string, action: TypedActions) => {
    // we MUST convert this else we'll run into issues with redux. See https://github.com/rackt/redux/issues/830
    // This is because this is touched due to the remote proxying. We get a __proto__ which causes the _.isPlainObject check to fail. We use
    setImmediate(() => {
      try {
        store.dispatch({
          payload: action.payload,
          type: action.type,
        })
      } catch (_) {}
    })
  })

  // See if we're connected, and try starting keybase if not
  setImmediate(() => {
    if (!eng.hasEverConnected()) {
      SafeElectron.getApp().emit('KBkeybase', '', {type: 'requestStartService'})
    }
  })

  // After a delay dump logs in case some startup stuff happened
  setTimeout(() => {
    dumpLogs()
  }, 5 * 1000)

  // Handle notifications from the service
  store.dispatch(NotificationsGen.createListenForNotifications())

  SafeElectron.getApp().emit('KBkeybase', '', {type: 'appStartedUp'})
}

const FontLoader = () => (
  <div style={{height: 0, overflow: 'hidden', width: 0}}>
    <p style={{fontFamily: 'kb'}}>kb</p>
    <p style={{fontFamily: 'Source Code Pro', fontWeight: 500}}>source code pro 500</p>
    <p style={{fontFamily: 'Source Code Pro', fontWeight: 600}}>source code pro 600</p>
    <p style={{fontFamily: 'Keybase', fontWeight: 400}}>keybase 400</p>
    <p style={{fontFamily: 'Keybase', fontStyle: 'italic', fontWeight: 400}}>keybase 400 i</p>
    <p style={{fontFamily: 'Keybase', fontWeight: 600}}>keybase 600</p>
    <p style={{fontFamily: 'Keybase', fontStyle: 'italic', fontWeight: 600}}>keybase 600 i</p>
    <p style={{fontFamily: 'Keybase', fontWeight: 700}}>keybase 700</p>
    <p style={{fontFamily: 'Keybase', fontStyle: 'italic', fontWeight: 700}}>keybase 700 i</p>
  </div>
)

let store

const DarkCSSInjector = () => {
  const className = useSelector(state => isDarkMode(state.config)) ? 'darkMode' : ''
  React.useEffect(() => {
    // inject it in body so modals get darkMode also
    document.body.className = className
  }, [className])
  return null
}

const render = (Component = Main) => {
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('No root element?')
  }

  ReactDOM.render(
    <Root store={store}>
      <DarkCSSInjector />
      <RemoteProxies />
      <FontLoader />
      <div style={{display: 'flex', flex: 1}}>
        <Component />
      </div>
    </Root>,
    root
  )
}

const setupHMR = _ => {
  const accept = module.hot && module.hot.accept
  if (!accept) {
    return
  }

  const refreshMain = () => {
    try {
      const NewMain = require('../../app/main.desktop').default
      render(NewMain)
    } catch (_) {}
  }

  accept(['../../app/main.desktop'], refreshMain)
  accept('../../common-adapters/index.js', () => {})
}

const setupDarkMode = () => {
  if (isDarwin && SafeElectron.getSystemPreferences().subscribeNotification) {
    SafeElectron.getSystemPreferences().subscribeNotification(
      'AppleInterfaceThemeChangedNotification',
      () => {
        store.dispatch(
          ConfigGen.createSetSystemDarkMode({
            dark: isDarwin && SafeElectron.getSystemPreferences().isDarkMode(),
          })
        )
      }
    )
  }
}

const load = () => {
  if (global.DEBUGLoaded) {
    // only load once
    console.log('Bail on load() on HMR')
    return
  }
  global.DEBUGLoaded = true
  initDesktopStyles()
  const temp = setupStore()
  const {runSagas} = temp
  store = temp.store
  setupApp(store, runSagas)
  setupHMR(store)
  setupDarkMode()
  render()
}

load()

// UI interactivity Radar
var asyncRenderToolbox = document.createElement('div')
asyncRenderToolbox.id = 'asyncRenderToolbox_div'
var asyncRenderToolbox_header = document.createElement('div')
asyncRenderToolbox_header.id = 'asyncRenderToolbox_divheader'
asyncRenderToolbox_header.textContent = 'async-render-toolbox (alt/⌥+R to toggle)'
asyncRenderToolbox.appendChild(asyncRenderToolbox_header)
document.body.prepend(asyncRenderToolbox)
dragElement(asyncRenderToolbox) // make it draggable
const destroy = lagRadar({parent: document.getElementById('asyncRenderToolbox_div')})
asyncRenderToolbox.style.top = document.documentElement.scrollTop + 30
asyncRenderToolbox.style.left = Math.round(window.innerWidth / 2) - 30
document.addEventListener('keyup', handleKeyUp, false)

// handleKeyUp
let asyncRenderToolboxActive = true

// we can use this programmatically in future
function toggleToolbox() {
  if (asyncRenderToolboxActive) {
    asyncRenderToolbox.style.display = 'none'
  } else {
    asyncRenderToolbox.style.display = 'block'
  }
  asyncRenderToolboxActive = !asyncRenderToolboxActive
}

function handleKeyUp(e) {
  // this would test for alt + R key
  if (e.altKey && e.keyCode == 82) {
    toggleToolbox()
  }
}

// dragger defitions
function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0
  // if (document.getElementById(elmnt.id + "header")) {
  //   /* if present, the header is where you move the DIV from:*/
  //   document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  // } else {
  //   /* otherwise, move the DIV from anywhere inside the DIV:*/
  //   elmnt.onmousedown = dragMouseDown;
  // }
  elmnt.onmousedown = dragMouseDown

  function dragMouseDown(e) {
    e = e || window.event
    // get the mouse cursor position at startup:
    pos3 = e.clientX
    pos4 = e.clientY
    document.onmouseup = closeDragElement
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag
  }

  function elementDrag(e) {
    e = e || window.event
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX
    pos2 = pos4 - e.clientY
    pos3 = e.clientX
    pos4 = e.clientY
    // set the element's new position:
    elmnt.style.top = elmnt.offsetTop - pos2 + 'px'
    elmnt.style.left = elmnt.offsetLeft - pos1 + 'px'
  }

  function closeDragElement() {
    /* stop moving when mouse button is released:*/
    document.onmouseup = null
    document.onmousemove = null
  }
}

function lagRadar(config = {}) {
  const {
    frames = 50, // number of frames to draw, more = worse performance
    speed = 0.0017, // how fast the sweep moves (rads per ms)
    size = 300, // outer frame px
    inset = 3, // circle inset px
    parent = document.body, // DOM node to attach to
  } = config

  const svgns = 'http://www.w3.org/2000/svg'

  const styles = document.createTextNode(`
    .lagRadar-sweep > * {
      shape-rendering: crispEdges;
    }
    .lagRadar-face {
      fill: transparent;
    }
    .lagRadar-hand {
      stroke-width: 4px;
      stroke-linecap: round;
    }
    #asyncRenderToolbox_div {
      position: absolute;
      right: 0px;
    }
  `)

  function $svg(tag, props = {}, children = []) {
    const el = document.createElementNS(svgns, tag)
    Object.keys(props).forEach(prop => el.setAttribute(prop, props[prop]))
    children.forEach(child => el.appendChild(child))
    return el
  }

  const PI2 = Math.PI * 2
  const middle = size / 2
  const radius = middle - inset

  const $hand = $svg('path', {class: 'lagRadar-hand'})
  const $arcs = new Array(frames).fill('path').map(t => $svg(t))
  const $root = $svg('svg', {class: 'lagRadar', height: size, width: size}, [
    $svg('style', {type: 'text/css'}, [styles]),
    $svg('g', {class: 'lagRadar-sweep'}, $arcs),
    $hand,
    $svg('circle', {class: 'lagRadar-face', cx: middle, cy: middle, r: radius}),
  ])

  parent.appendChild($root)

  let frame
  let framePtr = 0
  let last = {
    rotation: 0,
    now: Date.now(),
    tx: middle + radius,
    ty: middle,
  }

  const calcHue = (() => {
    const max_hue = 120
    const max_ms = 1000
    const log_f = 10
    const mult = max_hue / Math.log(max_ms / log_f)
    return function(ms_delta) {
      return max_hue - Math.max(0, Math.min(mult * Math.log(ms_delta / log_f), max_hue))
    }
  })()

  function animate() {
    const now = Date.now()
    const rdelta = Math.min(PI2 - speed, speed * (now - last.now))
    const rotation = (last.rotation + rdelta) % PI2
    const tx = middle + radius * Math.cos(rotation)
    const ty = middle + radius * Math.sin(rotation)
    const bigArc = rdelta < Math.PI ? '0' : '1'
    const path = `M${tx} ${ty}A${radius} ${radius} 0 ${bigArc} 0 ${last.tx} ${last.ty}L${middle} ${middle}`
    const hue = calcHue(rdelta / speed)

    $arcs[framePtr % frames].setAttribute('d', path)
    $arcs[framePtr % frames].setAttribute('fill', `hsl(${hue}, 80%, 40%)`)
    $hand.setAttribute('d', `M${middle} ${middle}L${tx} ${ty}`)
    $hand.setAttribute('stroke', `hsl(${hue}, 80%, 60%)`)

    for (let i = 0; i < frames; i++) {
      $arcs[(frames + framePtr - i) % frames].style.fillOpacity = 1 - i / frames
    }

    framePtr++
    last = {now, rotation, tx, ty}

    frame = window.requestAnimationFrame(animate)
  }

  animate()

  return function destroy() {
    if (frame) {
      window.cancelAnimationFrame(frame)
    }
    $root.remove()
  }
}
