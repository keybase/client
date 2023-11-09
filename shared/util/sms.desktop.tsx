const openSMS = async () => {
  console.warn('Attempted to open SMS on desktop')
  return Promise.reject(new Error("Can't open SMS on desktop"))
}

export default openSMS
