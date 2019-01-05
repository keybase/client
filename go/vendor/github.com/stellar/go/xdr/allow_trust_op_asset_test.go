package xdr_test

import (
	. "github.com/stellar/go/xdr"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("xdr.AllowTrustOpAsset#ToAsset()", func() {
	It("works", func() {
		var aid AccountId
		aid.SetAddress("GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH")
		ata, _ := NewAllowTrustOpAsset(AssetTypeAssetTypeCreditAlphanum4, [4]byte{0x01})
		a := ata.ToAsset(aid)
		Expect(a.Type).To(Equal(AssetTypeAssetTypeCreditAlphanum4))
		Expect(a.MustAlphaNum4().AssetCode[0]).To(Equal(uint8(0x01)))

		ata, _ = NewAllowTrustOpAsset(AssetTypeAssetTypeCreditAlphanum12, [12]byte{0x02})
		a = ata.ToAsset(aid)
		Expect(a.Type).To(Equal(AssetTypeAssetTypeCreditAlphanum12))
		Expect(a.MustAlphaNum12().AssetCode[0]).To(Equal(uint8(0x02)))
	})
})
