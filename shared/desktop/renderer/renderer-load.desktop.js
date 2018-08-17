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

// Require the electron spellchecker
const electronSpellchecker = require('electron-spellchecker')

// Retrieve required properties
const SpellCheckHandler = electronSpellchecker.SpellCheckHandler
const ContextMenuListener = electronSpellchecker.ContextMenuListener
const ContextMenuBuilder = electronSpellchecker.ContextMenuBuilder

// Configure the spellcheckhandler
window.spellCheckHandler = new SpellCheckHandler()
window.spellCheckHandler.attachToInput()

// Start off as "US English, America"
window.spellCheckHandler.switchLanguage('en-US')

// Create the builder with the configured spellhandler
let contextMenuBuilder = new ContextMenuBuilder(window.spellCheckHandler)

// Add context menu listener
let contextMenuListener = new ContextMenuListener(info => {
  contextMenuBuilder.showPopupMenu(info)
})
