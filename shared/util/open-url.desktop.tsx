const openURL = (url: string | null) => {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  KB.shell.openExternal(url)
}

export default openURL
