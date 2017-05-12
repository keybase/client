// @flow
import {ipcMain} from 'electron'
import openUrl from '../../util/open-url'
import {urlHelper} from '../../util/url-helper'

export default function() {
  ipcMain.on('openURL', (event, type, params) => {
    const link = urlHelper(type, params)
    link && openUrl(link)
  })
}
