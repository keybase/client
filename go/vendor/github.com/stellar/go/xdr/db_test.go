package xdr_test

import (
	"database/sql"

	. "github.com/stellar/go/xdr"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/ginkgo/extensions/table"
	. "github.com/onsi/gomega"
)

var _ = Describe("sql.Scanner implementations", func() {

	DescribeTable("AccountFlags",
		func(in interface{}, val AccountFlags, shouldSucceed bool) {
			var scanned AccountFlags
			err := scanned.Scan(in)

			if shouldSucceed {
				Expect(err).To(BeNil())
			} else {
				Expect(err).ToNot(BeNil())
			}

			Expect(scanned).To(Equal(val))
		},
		Entry("zero", int64(0), AccountFlags(0), true),
		Entry("required", int64(1), AccountFlags(1), true),
		Entry("revokable", int64(2), AccountFlags(2), true),
		Entry("immutable", int64(4), AccountFlags(4), true),
		Entry("string", "0", AccountFlags(0), false),
	)

	DescribeTable("AssetType",
		func(in interface{}, val AssetType, shouldSucceed bool) {
			var scanned AssetType
			err := scanned.Scan(in)

			if shouldSucceed {
				Expect(err).To(BeNil())
			} else {
				Expect(err).ToNot(BeNil())
			}

			Expect(scanned).To(Equal(val))
		},
		Entry("native", int64(0), AssetTypeAssetTypeNative, true),
		Entry("credit alphanum4", int64(1), AssetTypeAssetTypeCreditAlphanum4, true),
		Entry("credit alphanum12", int64(2), AssetTypeAssetTypeCreditAlphanum12, true),
		Entry("string", "native", AssetTypeAssetTypeNative, false),
	)

	DescribeTable("Int64",
		func(in interface{}, val Int64, shouldSucceed bool) {
			var scanned Int64
			err := scanned.Scan(in)

			if shouldSucceed {
				Expect(err).To(BeNil())
			} else {
				Expect(err).ToNot(BeNil())
			}

			Expect(scanned).To(Equal(val))
		},
		Entry("pos", int64(1), Int64(1), true),
		Entry("neg", int64(-1), Int64(-1), true),
		Entry("zero", int64(0), Int64(0), true),
		Entry("string", "0", Int64(0), false),
	)

	DescribeTable("Thresholds",
		func(in interface{}, val Thresholds, shouldSucceed bool) {
			var scanned Thresholds
			err := scanned.Scan(in)

			if shouldSucceed {
				Expect(err).To(BeNil())
			} else {
				Expect(err).ToNot(BeNil())
			}

			Expect(scanned).To(Equal(val))
		},
		Entry("default", "AQAAAA==", Thresholds{0x01, 0x00, 0x00, 0x00}, true),
		Entry("non-default", "AgACAg==", Thresholds{0x02, 0x00, 0x02, 0x02}, true),
		Entry("bytes", []byte("AQAAAA=="), Thresholds{0x01, 0x00, 0x00, 0x00}, true),
		Entry("number", 0, Thresholds{}, false),
	)

	DescribeTable("Scanning base64 strings (happy paths only)",
		func(dest interface{}, in string) {
			err := dest.(sql.Scanner).Scan(in)
			Expect(err).To(BeNil())
		},
		Entry("LedgerEntryChanges", &LedgerEntryChanges{},
			"AAAAAgAAAAMAAAABAAAAAAAAAABi/B0L0JGythwN1lY0aypo19NHxvLCyO5tBEcCVvwF9w3gtrOnZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAACAAAAAAAAAABi/B0L0JGythwN1lY0aypo19NHxvLCyO5tBEcCVvwF9w3gtrOnY/+cAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAA=="),
		Entry("LedgerHeader", &LedgerHeader{},
			"AAAAAWPZj1Nu5o0bJ7W4nyOvUxG3Vpok+vFAOtC1K2M7B76ZlmEdOpVCM5HLr9FNj55qa6w2HKMtqTPFLvG8yPU/aAoAAAAAVmX5PQAAAAIAAAAIAAAAAQAAAAEAAAAIAAAAAwAAADIAAAAARUAVxJm1lDMwwqujKcyQzs97F/AETiCgQPrw63wqaPGOtj0VqejCRGn8A4KwJni7nqeau/0Ehh/Gk8yEDm7nHgAAAAIN4Lazp2QAAAAAAAAAAAEsAAAAAAAAAAAAAAAAAAAAZAX14QAAAAAyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
		Entry("ScpEnvelope", &ScpEnvelope{},
			"AAAAAHrhN3GHEnrzTWJhFpClc59zx+BDb5xg65XqG+z5jnC7AAAAAAAAAAMAAAACAAAAAQAAADC/LifyiYybRvcg7+v7J44d4hsQc5Zc16IYRoo1xslnCAAAAABWZfk+AAAAAAAAAAAAAAABebIw2H2gD0qa+oOpLf5MdO3oYdixAJ2WXGefyG5JefMAAABAvTupFluE8rWgS3FR8nUi34+ya58L+Lv4KwYBeCxaibmjuqjlYL7EnIYORmAWVQPYHoviKOIidnB6JHfWXkZ+BQ=="),
		Entry("ScpQuorumSet", &ScpQuorumSet{},
			"AAAAAQAAAAEAAAAAeuE3cYcSevNNYmEWkKVzn3PH4ENvnGDrleob7PmOcLsAAAAA"),
		Entry("TransactionEnvelope", &TransactionEnvelope{},
			"AAAAAGL8HQvQkbK2HA3WVjRrKmjX00fG8sLI7m0ERwJW/AX3AAAAZAAAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA5BFB2+Hs81DQk/cAlJes5R0+3PUQaZ62NZJoKPsBWnsAAAACVAvkAAAAAAAAAAABVvwF9wAAAEC96/+BcbMflvMQfFAQTbAKGu+6BR1M6SG/KVzTJSlIY8ovSVywuthk9dOW9jm23siTiIZE0IAl84wK83gnAcEK"),
		Entry("TransactionMeta", &TransactionMeta{},
			"AAAAAAAAAAEAAAACAAAAAAAAAAIAAAAAAAAAAOQRQdvh7PNQ0JP3AJSXrOUdPtz1EGmetjWSaCj7AVp7AAAAAlQL5AAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAIAAAAAAAAAAGL8HQvQkbK2HA3WVjRrKmjX00fG8sLI7m0ERwJW/AX3DeC2sVNYGtQAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAA"),
		Entry("TransactionResult", &TransactionResult{},
			"AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA="),
	)
})
