// Contact info coming from the native contacts library.
export type Contact = {
  id: string // unique per-contact ID
  name: string
  pictureUri?: string
  type: 'phone' | 'email'
  value: string
  valueFormatted?: string
}
