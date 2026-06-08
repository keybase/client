import * as Validators from '@/util/simple-validators'

export type PGPInfo = {
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpFullName: string
}

export const validatePgpInfo = (info: PGPInfo) => {
  const email1Error = Validators.isValidEmail(info.pgpEmail1)
  const email2Error = info.pgpEmail2 ? Validators.isValidEmail(info.pgpEmail2) : ''
  const email3Error = info.pgpEmail3 ? Validators.isValidEmail(info.pgpEmail3) : ''
  const nameError = Validators.isValidName(info.pgpFullName)

  return {
    pgpErrorEmail1: !!email1Error,
    pgpErrorEmail2: !!email2Error,
    pgpErrorEmail3: !!email3Error,
    pgpErrorText: nameError || email1Error || email2Error || email3Error,
  }
}
