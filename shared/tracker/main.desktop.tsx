// Entry point for the tracker render window
import '../desktop/renderer/globals.desktop'
import {waitOnKB2Loaded} from '@/util/electron.desktop'
waitOnKB2Loaded(() => {
  import('@/tracker/main2.desktop').then(() => {}).catch(() => {})
})
