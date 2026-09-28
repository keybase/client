import {normalizePath} from '@/styles'

export const isKbfsPath = (path: string) => path.startsWith('/keybase/')

// Local files need the file:// scheme on mobile, but kbfs paths aren't on disk:
// the service reads them through SimpleFS and they must stay recognizable as kbfs.
export const toAttachmentPath = (path: string) => (isKbfsPath(path) ? path : normalizePath(path))
