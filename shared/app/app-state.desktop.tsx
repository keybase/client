// TODO entirely remove this file
// This is modified from https://github.com/mawie81/electron-window-state
import * as SafeElectron from '../util/safe-electron.desktop'
import fs from 'fs'
import path from 'path'
import logger from '../logger'

export type Config = {
  path: string
  eventHandlingDelay: number
}

export type Options = {
  defaultWidth: number
  defaultHeight: number
}

export type Managed = {
  winRef: any | null
  debounceChangeTimer?: NodeJS.Timer
}

export default class AppState {
  state = {
    dockHidden: false,
  }
  config: Config
  managed: Managed

  constructor() {
    this.config = {
      eventHandlingDelay: 1000,
      path: path.join(SafeElectron.getApp().getPath('userData'), 'app-state.json'),
    }

    this.managed = {
      debounceChangeTimer: undefined,
      winRef: null,
    }

    type Action =
      | {type: 'get'}
      | {type: 'set'; payload: {data: any}}
      | {type: 'reply'; payload: {data: any}}
      | {type: 'dock'; payload: {showing: boolean}}
    // Listen to the main window asking for this value
    SafeElectron.getApp().on('KBappState' as any, (_: string, action: Action) => {
      switch (action.type) {
        case 'get':
          SafeElectron.getApp().emit('KBappState', '', {payload: {data: this.state}, type: 'reply'})
          break
        case 'set':
          this.state = {
            ...this.state,
            ...action.payload.data,
          }
          this.saveState()
          break
        case 'dock':
          this.state.dockHidden = !action.payload.showing
          this.saveState()
          break
      }
    })

    this._loadStateSync()
  }

  // Changing this to use fs.writeFileSync because:
  //
  // https://nodejs.org/api/fs.html#fs_fs_writefile_file_data_options_callback
  // > Note that it is unsafe to use fs.writeFile multiple times on the same file without waiting for the callback.
  //
  // It's hard to reproduce, but I have seen cases where this app-state.json file gets messed up.
  saveState() {
    try {
      let configPath = this.config.path
      let stateToSave = this.state
      fs.writeFileSync(configPath, JSON.stringify(stateToSave))
    } catch (err) {
      logger.info(`Error saving file: ${err}`)
    }
  }

  _loadStateSync() {
    let configPath = this.config.path
    try {
      // @ts-ignore codemod issue
      fs.accessSync(configPath, fs.F_OK)
    } catch (e) {
      logger.info('No app state')
      return
    }
    try {
      const stateLoaded = JSON.parse(fs.readFileSync(configPath, {encoding: 'utf8'}))
      this.state = stateLoaded
    } catch (e) {
      console.warn('Error loading app state:', e)
    }
  }

  _updateState() {
    this.saveState()
  }

  _debounceChangeHandler() {
    this.managed.debounceChangeTimer && clearTimeout(this.managed.debounceChangeTimer)
    this.managed.debounceChangeTimer = setTimeout(() => {
      this._updateState()
    }, this.config.eventHandlingDelay)
  }
}
