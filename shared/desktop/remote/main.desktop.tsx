// Entry point for all remote render windows. The window's URL says which
// component to load: remote.html?component=<name>&param=<param>
import '../renderer/globals.desktop'
import {waitOnKB2Loaded} from '@/util/electron'

waitOnKB2Loaded(() => {
  const component = new URLSearchParams(window.location.search).get('component')
  const onErr = (e: unknown) => {
    console.error(`remote ${component} main2.desktop load failed`, e)
  }
  switch (component) {
    case 'menubar':
      import('@/menubar/main2.desktop')
        .then(() => {})
        .catch(onErr)
      break
    case 'pinentry':
      import('@/pinentry/main2.desktop')
        .then(() => {})
        .catch(onErr)
      break
    case 'tracker':
      import('@/tracker/main2.desktop')
        .then(() => {})
        .catch(onErr)
      break
    case 'unlock-folders':
      import('@/unlock-folders/main2.desktop')
        .then(() => {})
        .catch(onErr)
      break
    default:
      console.error('remote window loaded with unknown component', component)
  }
})
