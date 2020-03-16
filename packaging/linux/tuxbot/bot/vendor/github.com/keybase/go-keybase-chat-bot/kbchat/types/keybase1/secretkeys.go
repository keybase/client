// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/secretkeys.avdl

package keybase1

type NaclSigningKeyPublic [32]byte

func (o NaclSigningKeyPublic) DeepCopy() NaclSigningKeyPublic {
	var ret NaclSigningKeyPublic
	copy(ret[:], o[:])
	return ret
}

type NaclSigningKeyPrivate [64]byte

func (o NaclSigningKeyPrivate) DeepCopy() NaclSigningKeyPrivate {
	var ret NaclSigningKeyPrivate
	copy(ret[:], o[:])
	return ret
}

type NaclDHKeyPublic [32]byte

func (o NaclDHKeyPublic) DeepCopy() NaclDHKeyPublic {
	var ret NaclDHKeyPublic
	copy(ret[:], o[:])
	return ret
}

type NaclDHKeyPrivate [32]byte

func (o NaclDHKeyPrivate) DeepCopy() NaclDHKeyPrivate {
	var ret NaclDHKeyPrivate
	copy(ret[:], o[:])
	return ret
}

type SecretKeys struct {
	Signing    NaclSigningKeyPrivate `codec:"signing" json:"signing"`
	Encryption NaclDHKeyPrivate      `codec:"encryption" json:"encryption"`
}

func (o SecretKeys) DeepCopy() SecretKeys {
	return SecretKeys{
		Signing:    o.Signing.DeepCopy(),
		Encryption: o.Encryption.DeepCopy(),
	}
}
