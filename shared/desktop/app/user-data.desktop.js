// @flow
import jsonfile from 'jsonfile'
import * as Path from '../../util/path.desktop'
import * as SafeElectron from '../../util/safe-electron.desktop'

export default class UserData<State> {
  state: State
  file: string

  constructor(file: string, defaultState: State) {
    this.file = file
    this.state = defaultState
    try {
      let state = jsonfile.readFileSync(this.configPath())
      this.state = state
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        console.log('No installer.json file')
      } else {
        console.warn('Error loading state:', err)
      }
    }
  }

  configPath = (): string => {
    return Path.join(SafeElectron.getApp().getPath('userData'), this.file)
  }

  save = () => {
    try {
      jsonfile.writeFile(this.configPath(), this.state)
    } catch (err) {
      console.warn('Error saving state:', err)
    }
  }
}
