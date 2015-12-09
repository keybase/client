function getQueryVariable(variable) {
  var query = window.location.search.substring(1)
    var vars = query.split("&")
    for (var i=0;i<vars.length;i++) {
      var pair = vars[i].split("=")
        if(pair[0] == variable){
          return pair[1]
        }
    }
  return false
}

if (getQueryVariable('debug') === 'true') {
  showMain.style.display = 'block'
}

import {shell, ipcRenderer, remote} from 'electron'
const app = remote.app
import path from 'path'

showHelp.addEventListener('click', () => { ipcRenderer.send('showHelp') })
showMain.addEventListener('click', () => { ipcRenderer.send('showMain') })
quit.addEventListener('click', () => { app.quit() })

function fixAnchors() {
var tags = document.getElementsByTagName('a');
  for (var i = 0 ; i < tags.length ; ++i) {
    var a = tags[i]
    a.addEventListener('click', function(event) {
      event.preventDefault()
      shell.openExternal(event.target.href)
    })
  }
}

fixAnchors()
