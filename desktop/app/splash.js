import isFirstTime from './first-time'
import {shell} from 'electron'
import {help} from '../shared/constants/urls'

export default () => {
  isFirstTime.then(firstTime => firstTime && shell.openExternal(help()))
}
