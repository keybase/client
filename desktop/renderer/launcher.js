import {shell, ipcRenderer, remote} from 'electron'
const app = remote.app

/* eslint-disable no-undef*/
if (getQueryVariable('debug') === 'true') {
  showMain.style.display = 'block'
}

showHelp.addEventListener('click', () => { ipcRenderer.send('showHelp') })
showMain.addEventListener('click', () => { ipcRenderer.send('showMain') })
quit.addEventListener('click', () => { app.emit('destroy') })
/* eslint-enable no-undef*/

var tags = document.getElementsByTagName('a')

for (var i = 0; i < tags.length; ++i) {
  var a = tags[i]
  a.addEventListener('click', function (event) {
    event.preventDefault()
    shell.openExternal(event.target.href)
  })
}
