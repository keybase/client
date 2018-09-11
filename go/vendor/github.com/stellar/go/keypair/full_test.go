package keypair

import (
	"encoding/hex"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/ginkgo/extensions/table"
	. "github.com/onsi/gomega"
)

var _ = Describe("keypair.Full", func() {
	var subject KP

	JustBeforeEach(func() {
		subject = &Full{seed}
	})

	ItBehavesLikeAKP(&subject)

	type SignCase struct {
		Message   string
		Signature string
	}

	DescribeTable("Sign()",
		func(c SignCase) {
			sig, err := subject.Sign([]byte(c.Message))
			actual := hex.EncodeToString(sig)

			Expect(actual).To(Equal(c.Signature))
			Expect(err).To(BeNil())
		},

		Entry("hello", SignCase{
			"hello",
			"2e75cc20d519111caaaadddf464bb650d2eaf0a5d18d745693a16100f2a4937bc1dffa8b0b1f61a276996d7ee8deb2d0dd9ee510556077b02dec16792e915c0a",
		}),
		Entry("this is a message", SignCase{
			"this is a message",
			"7b7e99d3d660a53913064d5da96abcfa0c422a88f1dca7f14cdbd22045b550030e60fcd1aad85fd08bb7425d95ca690c8f63231895f6b0dd7c0c737227092a00",
		}),
	)

	Describe("SignDecorated()", func() {
		It("returns the correct xdr struct", func() {
			sig, err := subject.SignDecorated(message)
			Expect(err).To(BeNil())
			Expect(sig.Hint).To(BeEquivalentTo(hint))
			Expect(sig.Signature).To(BeEquivalentTo(signature))
		})
	})

})
