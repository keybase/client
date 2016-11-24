// @flow
import isFirstTime from './first-time'
import {shell} from 'electron'
import {helpUrl} from '../../constants/urls'

export default () => {
  isFirstTime.then(firstTime => firstTime && shell.openExternal(helpUrl))
}
