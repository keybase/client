// Entry point for the unlock folders render window
import '../desktop/renderer/globals.desktop'
import {waitOnKB2Loaded} from '../util/electron.desktop'
waitOnKB2Loaded(() => require('./main2.desktop'))
