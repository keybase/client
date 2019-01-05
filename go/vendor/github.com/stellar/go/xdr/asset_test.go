package xdr_test

import (
	. "github.com/stellar/go/xdr"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("xdr.Asset#Extract()", func() {
	var asset Asset

	Context("asset is native", func() {
		BeforeEach(func() {
			var err error
			asset, err = NewAsset(AssetTypeAssetTypeNative, nil)
			Expect(err).To(BeNil())
		})

		It("can extract to AssetType", func() {
			var typ AssetType
			err := asset.Extract(&typ, nil, nil)
			Expect(err).To(BeNil())
			Expect(typ).To(Equal(AssetTypeAssetTypeNative))
		})

		It("can extract to string", func() {
			var typ string
			err := asset.Extract(&typ, nil, nil)
			Expect(err).To(BeNil())
			Expect(typ).To(Equal("native"))
		})
	})

	Context("asset is credit_alphanum4", func() {
		BeforeEach(func() {
			var err error
			an := AssetAlphaNum4{}
			err = an.Issuer.SetAddress("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H")
			Expect(err).To(BeNil())
			copy(an.AssetCode[:], []byte("USD"))

			asset, err = NewAsset(AssetTypeAssetTypeCreditAlphanum4, an)
			Expect(err).To(BeNil())
		})

		It("can extract when typ is AssetType", func() {
			var typ AssetType
			var code, issuer string

			err := asset.Extract(&typ, &code, &issuer)
			Expect(err).To(BeNil())
			Expect(typ).To(Equal(AssetTypeAssetTypeCreditAlphanum4))
			Expect(code).To(Equal("USD"))
			Expect(issuer).To(Equal("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"))
		})

		It("can extract to strings", func() {
			var typ, code, issuer string

			err := asset.Extract(&typ, &code, &issuer)
			Expect(err).To(BeNil())
			Expect(typ).To(Equal("credit_alphanum4"))
			Expect(code).To(Equal("USD"))
			Expect(issuer).To(Equal("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"))
		})

	})
})

var _ = Describe("xdr.Asset#String()", func() {
	var asset Asset

	Context("asset is native", func() {
		BeforeEach(func() {
			var err error
			asset, err = NewAsset(AssetTypeAssetTypeNative, nil)
			Expect(err).To(BeNil())
		})

		It("returns 'native'", func() {
			Expect(asset.String()).To(Equal("native"))
		})
	})

	Context("asset is credit_alphanum4", func() {
		BeforeEach(func() {
			var err error
			an := AssetAlphaNum4{}
			err = an.Issuer.SetAddress("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H")
			Expect(err).To(BeNil())
			copy(an.AssetCode[:], []byte("USD"))

			asset, err = NewAsset(AssetTypeAssetTypeCreditAlphanum4, an)
			Expect(err).To(BeNil())
		})

		It("returns 'type/code/issuer'", func() {
			Expect(asset.String()).To(Equal("credit_alphanum4/USD/GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"))
		})
	})
})

var _ = Describe("xdr.Asset#Equals()", func() {
	var (
		issuer1       AccountId
		issuer2       AccountId
		usd4          [4]byte
		usd12         [12]byte
		eur4          [4]byte
		native        Asset
		usd4_issuer1  Asset
		usd4_issuer2  Asset
		usd12_issuer1 Asset
		eur4_issuer1  Asset
	)

	BeforeEach(func() {
		err := issuer1.SetAddress("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H")
		Expect(err).To(BeNil())
		err = issuer2.SetAddress("GCCB23N7VU2U3JHZYSX7HKK6WBBUMHFP4GOXYOZDETXTICY6BR26EGJY")
		Expect(err).To(BeNil())

		copy(usd4[:], []byte("USD"))
		copy(usd12[:], []byte("USD"))
		copy(eur4[:], []byte("EUR"))

		native, err = NewAsset(AssetTypeAssetTypeNative, nil)
		Expect(err).To(BeNil())

		usd4_issuer1, err = NewAsset(AssetTypeAssetTypeCreditAlphanum4, AssetAlphaNum4{
			Issuer:    issuer1,
			AssetCode: usd4,
		})
		Expect(err).To(BeNil())

		usd4_issuer2, err = NewAsset(AssetTypeAssetTypeCreditAlphanum4, AssetAlphaNum4{
			Issuer:    issuer2,
			AssetCode: usd4,
		})
		Expect(err).To(BeNil())

		usd12_issuer1, err = NewAsset(AssetTypeAssetTypeCreditAlphanum12, AssetAlphaNum12{
			Issuer:    issuer1,
			AssetCode: usd12,
		})
		Expect(err).To(BeNil())

		eur4_issuer1, err = NewAsset(AssetTypeAssetTypeCreditAlphanum4, AssetAlphaNum4{
			Issuer:    issuer1,
			AssetCode: eur4,
		})
		Expect(err).To(BeNil())
	})

	It("returns true for self comparisons", func() {
		Expect(native.Equals(native)).To(BeTrue())
		Expect(usd4_issuer1.Equals(usd4_issuer1)).To(BeTrue())
		Expect(usd4_issuer2.Equals(usd4_issuer2)).To(BeTrue())
		Expect(usd12_issuer1.Equals(usd12_issuer1)).To(BeTrue())
		Expect(eur4_issuer1.Equals(eur4_issuer1)).To(BeTrue())
	})

	It("returns false for differences", func() {
		// type mismatch
		Expect(native.Equals(usd4_issuer1)).To(BeFalse())
		Expect(native.Equals(usd12_issuer1)).To(BeFalse())
		Expect(usd4_issuer1.Equals(usd12_issuer1)).To(BeFalse())

		// issuer mismatch
		Expect(usd4_issuer1.Equals(usd12_issuer1)).To(BeFalse())

		// code mismatch
		Expect(usd4_issuer1.Equals(eur4_issuer1)).To(BeFalse())
	})

})
