package keypair

import (
	"testing"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/ginkgo/extensions/table"
	. "github.com/onsi/gomega"
	"github.com/onsi/gomega/types"
)

func TestBuild(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Package: github.com/stellar/go/keypair")
}

var (
	address   = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"
	seed      = "SDHOAMBNLGCE2MV5ZKIVZAQD3VCLGP53P3OBSBI6UN5L5XZI5TKHFQL4"
	hint      = [4]byte{0x56, 0xfc, 0x05, 0xf7}
	message   = []byte("hello")
	signature = []byte{
		0x2E, 0x75, 0xcc, 0x20, 0xd5, 0x19, 0x11, 0x1c, 0xaa, 0xaa, 0xdd, 0xdf,
		0x46, 0x4b, 0xb6, 0x50, 0xd2, 0xea, 0xf0, 0xa5, 0xd1, 0x8d, 0x74, 0x56,
		0x93, 0xa1, 0x61, 0x00, 0xf2, 0xa4, 0x93, 0x7b, 0xc1, 0xdf, 0xfa, 0x8b,
		0x0b, 0x1f, 0x61, 0xa2, 0x76, 0x99, 0x6d, 0x7e, 0xe8, 0xde, 0xb2, 0xd0,
		0xdd, 0x9e, 0xe5, 0x10, 0x55, 0x60, 0x77, 0xb0, 0x2d, 0xec, 0x16, 0x79,
		0x2e, 0x91, 0x5c, 0x0a,
	}
)

func ItBehavesLikeAKP(subject *KP) {

	// NOTE: subject will only be valid to dereference when inside am "It"
	// example.

	Describe("Address()", func() {
		It("returns the correct address", func() {
			Expect((*subject).Address()).To(Equal(address))
		})
	})

	Describe("Hint()", func() {
		It("returns the correct hint", func() {
			Expect((*subject).Hint()).To(Equal(hint))
		})
	})

	type VerifyCase struct {
		Message   []byte
		Signature []byte
		Case      types.GomegaMatcher
	}

	DescribeTable("Verify()",
		func(vc VerifyCase) {
			Expect((*subject).Verify(vc.Message, vc.Signature)).To(vc.Case)
		},
		Entry("correct", VerifyCase{message, signature, BeNil()}),
		Entry("empty signature", VerifyCase{message, []byte{}, Equal(ErrInvalidSignature)}),
		Entry("empty message", VerifyCase{[]byte{}, signature, Equal(ErrInvalidSignature)}),
		Entry("different message", VerifyCase{[]byte("diff"), signature, Equal(ErrInvalidSignature)}),
		Entry("malformed signature", VerifyCase{message, signature[0:10], Equal(ErrInvalidSignature)}),
	)
}

type ParseCase struct {
	Input    string
	TypeCase types.GomegaMatcher
	ErrCase  types.GomegaMatcher
}

var _ = DescribeTable("keypair.Parse()",
	func(c ParseCase) {
		kp, err := Parse(c.Input)

		Expect(kp).To(c.TypeCase)
		Expect(err).To(c.ErrCase)
	},

	Entry("a valid address", ParseCase{
		Input:    "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
		TypeCase: BeAssignableToTypeOf(&FromAddress{}),
		ErrCase:  BeNil(),
	}),
	Entry("a corrupted address", ParseCase{
		Input:    "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7O32H",
		TypeCase: BeNil(),
		ErrCase:  HaveOccurred(),
	}),
	Entry("a valid seed", ParseCase{
		Input:    "SDHOAMBNLGCE2MV5ZKIVZAQD3VCLGP53P3OBSBI6UN5L5XZI5TKHFQL4",
		TypeCase: BeAssignableToTypeOf(&Full{}),
		ErrCase:  BeNil(),
	}),
	Entry("a corrupted seed", ParseCase{
		Input:    "SDHOAMBNLGCE2MV5ZKIVZAQD3VCLGP53P3OBSBI6UN5L5XZI5TKHFQL3",
		TypeCase: BeNil(),
		ErrCase:  HaveOccurred(),
	}),
	Entry("a blank string", ParseCase{
		Input:    "",
		TypeCase: BeNil(),
		ErrCase:  HaveOccurred(),
	}),
)
