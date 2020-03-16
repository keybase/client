// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/crypto.avdl

package keybase1

type ED25519PublicKey [32]byte

func (o ED25519PublicKey) DeepCopy() ED25519PublicKey {
	var ret ED25519PublicKey
	copy(ret[:], o[:])
	return ret
}

type ED25519Signature [64]byte

func (o ED25519Signature) DeepCopy() ED25519Signature {
	var ret ED25519Signature
	copy(ret[:], o[:])
	return ret
}

type ED25519SignatureInfo struct {
	Sig       ED25519Signature `codec:"sig" json:"sig"`
	PublicKey ED25519PublicKey `codec:"publicKey" json:"publicKey"`
}

func (o ED25519SignatureInfo) DeepCopy() ED25519SignatureInfo {
	return ED25519SignatureInfo{
		Sig:       o.Sig.DeepCopy(),
		PublicKey: o.PublicKey.DeepCopy(),
	}
}

type EncryptedBytes32 [48]byte

func (o EncryptedBytes32) DeepCopy() EncryptedBytes32 {
	var ret EncryptedBytes32
	copy(ret[:], o[:])
	return ret
}

type BoxNonce [24]byte

func (o BoxNonce) DeepCopy() BoxNonce {
	var ret BoxNonce
	copy(ret[:], o[:])
	return ret
}

type BoxPublicKey [32]byte

func (o BoxPublicKey) DeepCopy() BoxPublicKey {
	var ret BoxPublicKey
	copy(ret[:], o[:])
	return ret
}

type CiphertextBundle struct {
	Kid        KID              `codec:"kid" json:"kid"`
	Ciphertext EncryptedBytes32 `codec:"ciphertext" json:"ciphertext"`
	Nonce      BoxNonce         `codec:"nonce" json:"nonce"`
	PublicKey  BoxPublicKey     `codec:"publicKey" json:"publicKey"`
}

func (o CiphertextBundle) DeepCopy() CiphertextBundle {
	return CiphertextBundle{
		Kid:        o.Kid.DeepCopy(),
		Ciphertext: o.Ciphertext.DeepCopy(),
		Nonce:      o.Nonce.DeepCopy(),
		PublicKey:  o.PublicKey.DeepCopy(),
	}
}

type UnboxAnyRes struct {
	Kid       KID     `codec:"kid" json:"kid"`
	Plaintext Bytes32 `codec:"plaintext" json:"plaintext"`
	Index     int     `codec:"index" json:"index"`
}

func (o UnboxAnyRes) DeepCopy() UnboxAnyRes {
	return UnboxAnyRes{
		Kid:       o.Kid.DeepCopy(),
		Plaintext: o.Plaintext.DeepCopy(),
		Index:     o.Index,
	}
}
