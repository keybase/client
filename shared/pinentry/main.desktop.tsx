// Entry point for the pinentry render window
import '../desktop/renderer/globals.desktop'
import {waitOnKB2Loaded} from '../util/electron.desktop'
waitOnKB2Loaded(() => require('./main2.desktop'))
