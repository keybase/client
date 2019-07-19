const openSMS = () => {
  console.warn('Attempted to open SMS on desktop')
  return new Promise((_, reject) => reject(new Error("Can't open SMS on desktop")))
}

export default openSMS
