require('electron').ipcRenderer.once('load', (event, options) => {
  document.title = options.windowTitle || document.title
  options.scripts.map(({src, async, defer}) => {
    const script = document.createElement('script')
    if (src == null) {
      throw new Error('No src for script. Nothing to load')
    }
    script.src = src
    async != null && (script.async = async)
    defer != null && (script.defer = defer)
    script.onload = () => window.load && window.load(options)
    script.onerror = e => console.warn('error loading initial scripts:', e)
    document.head.appendChild(script)
  })
})

const electronSpellchecker = require('electron-spellchecker')
const SpellCheckHandler = electronSpellchecker.SpellCheckHandler
const ContextMenuListener = electronSpellchecker.ContextMenuListener
const ContextMenuBuilder = electronSpellchecker.ContextMenuBuilder

window.spellCheckHandler = new SpellCheckHandler()
window.spellCheckHandler.attachToInput()
window.spellCheckHandler.switchLanguage(navigator.language || 'en-US')

const contextMenuBuilder = new ContextMenuBuilder(window.spellCheckHandler)
new ContextMenuListener(info => {
  contextMenuBuilder.showPopupMenu(info)
})
