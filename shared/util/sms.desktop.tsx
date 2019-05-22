const openSMS = (phoneno: Array<string>, body?: string): Promise<any> => {
  console.warn('Attempted to open SMS on desktop')
  return new Promise((resolve, reject) => reject(new Error("Can't open SMS on desktop")))
}

export default openSMS
