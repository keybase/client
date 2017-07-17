// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"encoding/base64"
	"io"
	"io/ioutil"
	"testing"
)

func newStreamFromBase64String(t *testing.T, s string) io.Reader {
	buf, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		t.Fatal(err)
	}
	return bytes.NewReader(buf)
}

func assertStreamEqBase64(t *testing.T, r io.Reader, m string) {
	buf, err := ioutil.ReadAll(r)
	if err != nil {
		t.Fatalf("an error occured during stream draining")
	}
	m2 := base64.StdEncoding.EncodeToString(buf)
	if m != m2 {
		t.Fatalf("the whole stream came back out")
	}
}

type testVector struct {
	msg string
	sc  StreamClassification
}

func TestClassifyTestVectors(t *testing.T) {

	vectors := []testVector{
		{
			msg: `owEBPQHC/pANAwAKAZgKPw0B/gTfAcsNYgBWiR6fZm9vYmFyCokBHAQAAQoABgUCVokenwAKCRCYCj8NAf4E38UACACoF9R9FJnZX7VqhHpOFgWgQR9wn8XJQ6DI7kkrlO1sF9OH3KoShuPT1G3J8/c4HXWY4qLluDfDN0sFA1Obt6PLQ4PJxWgZzuTed+f/zJ9NiQc2XdqT/iUPSEvWFKHI+1apF04iCjBs4dJaJOPAZdq4ZZ/7LAi8GwwDY5v3FJvwur180568tTcVTQtZqg3IhFGCMVZwD/S4x6DNdRxQB796SgbyGg/B8A9/vUEjMuUv6XU2sJcNNXuRfWYX0E+gsRg0kwjQlDOHvB+mDtu/qxVAd/Zm2y7NCoEHBH2jLI50Ls2OTHf98p43oHMofoQCnzP0nRu7bu4W4lVFEIqIXZvO`,
			sc: StreamClassification{
				Format:  CryptoMessageFormatPGP,
				Type:    CryptoMessageTypeAttachedSignature,
				Armored: false,
			},
		}, {
			msg: "hQEMA5gKPw0B/gTfAQf/W3Ra0uwZvzn3pxIcLTOFodqI5tsb3aZdIlfo/O36ekkbubizGrtSbc2rA23HeZOgWHM5zwsf6GU9UwG1ToC/ORtemQuAwx08DSr3NbSSxyyiPI+6936TVCxnXMBEBSvk20rhDeLFiqnuDzrtWcnHAKYIQ8XG6HfRN2ibvn8nvLH+dfuQhzNx9bsHSCKRyV44ziExScoSW8TJdenpXg1UoYKG4Ti/t5QGaiGZEZIkjM+bVR4jHzUmY0VFso8OfN4rn2rbQtvbV50oRDgxKOsfJTxvs0nsXiOsviaFA62fUiXXv4bWsDTB5urpovzjuzUw/VlWyBZTuIuAshcrBo4RnNJVAb0yxFCLt+BbwUTQoOWzTC5hWBgivG/lYTpbGJ/C4xWQCszy/IXb7ZPDiH+i/V4DRh2LrF/AOql8sh0Qx9j3mJUHaYaWv6K1wptOvLEF02iZWyhWGg==",
			sc: StreamClassification{
				Format:  CryptoMessageFormatPGP,
				Type:    CryptoMessageTypeEncryption,
				Armored: false,
			},
		}, {
			msg: "iQEcBAABCgAGBQJWiYjOAAoJEJgKPw0B/gTfASkH+wSCsUYLOMbeWUSil0C96T3Ug5vhZ/kd/UThhs+06FSxvvD9t9oTLQnJmYjV3zHmgQ/w0kc5ue00r8WMJelatE9y/TwTfiRgyRbs/5Y95GBiy/KBu2ygZ5tDt/jEaH5bHh3v86cSf9e70oxvqvSof6KFIWIQBZM87Y4TCrVHIQ2VrXm7DASPaSKo8fv+6bEHn18ii9U4IpOPUD7mxM9jr5388mFGBSe/2+L5o1mHwpfpLXUxt0Hehv9mAhzwy4WNszWg25BIbwZ65THrfbw938KDIkymE0bFfMXbY252HEEstUmKAFZ5obalryu851QPjTlW/eQnBS/ahvYS1q/3g8k=",
			sc: StreamClassification{
				Format:  CryptoMessageFormatPGP,
				Type:    CryptoMessageTypeDetachedSignature,
				Armored: false,
			},
		}, {
			msg: "LS0tLS1CRUdJTiBQR1AgU0lHTkFUVVJFLS0tLS0KQ29tbWVudDogR1BHVG9vbHMgLSBodHRwczovL2dwZ3Rvb2xzLm9yZwoKaVFFY0JBQUJDZ0FHQlFKV2lZb3FBQW9KRUpnS1B3MEIvZ1RmMUxRSC9SQk1xbzh3bXQyRUx6T0xuaEVWOVB3VgpRa00yTHh4WktOU216MmtxWDBNQytrWW11STU5ZExSS1EvaEx3V0JtcllzSjZqMUxkVnB0Z0JwdmEwbUhFRmNUCmdyTnZiMk14ZDdkdEpFQkJvRVdob3JzMTZUY0lDQ2lRazczRUc5TDZ4TUZrSU5aNEVkeFRxRDNzRllHSjduRkQKQktiNmV6RHBDVit4dnFRdTRMRGxsd2Q0WDFaOVo1RFR1R2VNNld4MVQ2cFRLNTVNeXZHZ0ZnQ011ZmJxd3hQKwpBVWFlbFVlRlYzbUtXN1R4Q0s3cVo0Um9GaC9zR1VOKytpcWo2NGF1MjRLeEpGdHVCbVk1LzFNbEt4ckJHVEVsCkJPV3dFdnhnK3MvWFFGcllmeFVDLzNQWVNINDFObklwVGVGZE9nTlZNRDAzWElrMEU5TmtJZ0c5SG54WVI3TT0KPXo4c1MKLS0tLS1FTkQgUEdQIFNJR05BVFVSRS0tLS0tCg==",
			sc: StreamClassification{
				Format:  CryptoMessageFormatPGP,
				Type:    CryptoMessageTypeDetachedSignature,
				Armored: true,
			},
		}, {
			// This one is an attached signature
			msg: "LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tCkNvbW1lbnQ6IEdQR1Rvb2xzIC0gaHR0cHM6Ly9ncGd0b29scy5vcmcKCm93RUJWQUdyL3BBTkF3QUtBWmdLUHcwQi9nVGZBY3NrWWdCV2lZdG1UbTkwYUdsdVp5QjNhV3hzSUdOdmJXVWcKYjJZZ2JtOTBhR2x1Wnk0S2lRRWNCQUFCQ2dBR0JRSldpWXRtQUFvSkVKZ0tQdzBCL2dUZmpvWUlBTHBiOStLVwo4OERJK2svRFBVc2JzSkN2d0RlRlZhN1BKZXF3VFNQQ2Y5cjhzVUFnZWVWcXVXM0JHNjkyNkgrV3lucG56cUF1ClBiY21SZ29XdWNVRVZPSHBYZkxsN292UkwxSURLYkJVcXNQUE5yUGdudUxzblY4NVJKMkkrOUxMYTM2SUptaE0KNFppM25sWU0xeGdYKzhQNm92TWdUeTQybzRSMTgrMStlZ1RDQ0grbVlhMkVKd1hEdGJ4T3AyQXN6aENrNlNlbwo2NjdxRllNOTdzYXk4ZlZUVkFwZlYrY0RJdHRxc01mcUJSMHJwZ1Vlb1ROdk5kNDlDVmVsSmVGMzdhOWt4UWpuCklPcmUrWmJjRzNKNUtOek1YZHpTT0xYcjNGWm42K2VCclBXSmZVemtrbVlmQnhucnhRcFpPVjA0Z09vZ05IK2YKLzBLRHZ4SktVYytrandRPQo9Sk1iNgotLS0tLUVORCBQR1AgTUVTU0FHRS0tLS0tCg==",
			sc: StreamClassification{
				Format:  CryptoMessageFormatPGP,
				Type:    CryptoMessageTypeAmbiguous,
				Armored: true,
			},
		}, {
			// This one is an encryption
			msg: "LS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tCkNvbW1lbnQ6IEdQR1Rvb2xzIC0gaHR0cHM6Ly9ncGd0b29scy5vcmcKCmhRRU1BeW5BcEhsdHBqT3JBUWY4Q0s1YTBSUmNLTFYrTEk2RDZjeEdYRDNhZmlZZFRVNy9KbVBzaWo4ZmF6VHgKcTk4SDRCYXY1WjJiZTRpY3UvMWh0S05iRjZyUG9GL0NWT0EwOXM4M09QYlJwd2doc2RScEVlMDhHQk5WVHFXOQpUQ253RmhKZHNUT21NUlMzTGZTZEFuT1RDcDVONXJLME41Rzl3cUdkZmtFT3NLN0dVdWpDYlh2M3pXWTZVeEF4Cm10Zi9jMU1SVGFPdDlUT1FidkhDK29xTkRENklNQ093bUo0OTVsVDJrUzBIaUd5Z1RPT003RjhNVEkvSmpLMSsKRWZ5SnRqdHlPK2FZS2VGQ053N3pseUZQWnQyWmRtb0VCVW1tZmcrYW1Icko2WHpTSjFIU0Vvd1lESFptSm9Wdgo5RlNteVd5ZUw1dkNmeHYyaTJZYkRKUk1LYjl1b2RxMGRIODNWdmV1SE5KUkFSa1FxTlRlb1BJN0VkVDQvS05LCjJCYmZBVWwydXZmSHh6MTBRbFRxYXorVmFRZ3poTDdnWFc5OFZvOXQwWldjWGg3bUEyQWozd2d3aElHdUt4MVgKQ2tzcE9IczVDb3pTOXdHdEFINnA1b1FhCj1lNXVxCi0tLS0tRU5EIFBHUCBNRVNTQUdFLS0tLS0K",
			sc: StreamClassification{
				Format:  CryptoMessageFormatPGP,
				Type:    CryptoMessageTypeAmbiguous,
				Armored: true,
			},
		}, {
			// This is made by removing the armor and base62 decoding before base64 encoding
			msg: "xFKVqHNhbHRwYWNrkgEAAcQgh5CBmJBG4rn55pNyntYpIGC7tTnXqKAwNEsKRUg2rcDEIBzNGdKOORv7lrE9ne4DnkLP16QTJ/O2Z5ph8OY+6ySBksRAut3Y6fqyNi0uRf4L5+xCEULkVWIextzFccdu3iuxoiKz47Y4IYjfasZMggbMY+QyZTPfTww3RfjASM64fR60DcQDZm9vksRA9MRowgZFqvlev2E2RbL8rBh5MTeKpNwi6oT6d95XBzzUyBrDiB3frwBQ5uNzpLdXQGqQYDzB4Dx8ZPoldtv+AMQA",
			sc: StreamClassification{
				Format:  CryptoMessageFormatSaltpack,
				Type:    CryptoMessageTypeAttachedSignature,
				Armored: false,
			},
		}, {
			// This is made by base64 encoding the cyphertext, including armor, with no binary step between
			msg: "QkVHSU4gS0VZQkFTRSBTQUxUUEFDSyBTSUdORUQgTUVTU0FHRS4ga1lNNWgxcGc2cXo5VU1uIGo2RzdLQjJPVWZ1MFdJaSAxWmZ5amRjWVZ3dUwwOWsgZTMzZWpnbWFObWZWckdQIDNLMlZSbTFaSUtNY1pRMCBPQjFyd1VqRjNPZnVSSkQgOVBMSmtDcFU4RnFvZFlQIHV4UlFwdjZ3aG1LUVRnTiBqbkEyYkFrNzRHYjJDTzYgdmNXbkFoTTdSUGlBYzFYIGFrMGx6RDVxMlNOT2diNyBreUphOEwwSThwSndHR1ggemdFS1QyNXlWcEZqanhiIGZ5MUc4anFaYTdpUDZqTSBrb3RMb2taZDJoYzBsdWQgQWROb2w0bGRIQ2VSR20wIFZpOXpFOTA5Vk5RS3Z1QSA0dWFsUnhTRmlyUWhqUzMgQXdEU21kU09mTHJuOThEIFpVTmNsVTMwMnlzeUJsNSBnMDAuIEVORCBLRVlCQVNFIFNBTFRQQUNLIFNJR05FRCBNRVNTQUdFLgo=",
			sc: StreamClassification{
				Format:  CryptoMessageFormatSaltpack,
				Type:    CryptoMessageTypeSignature,
				Armored: true,
			},
		}, {
			msg: "LS0tLS1CRUdJTiBQR1AgU0lHTkVEIE1FU1NBR0UtLS0tLQpIYXNoOiBTSEE1MTIKCmZvbwotLS0tLUJFR0lOIFBHUCBTSUdOQVRVUkUtLS0tLQpDb21tZW50OiBHUEdUb29scyAtIGh0dHBzOi8vZ3BndG9vbHMub3JnCgppUUVjQkFFQkNnQUdCUUpXaXZHcEFBb0pFSmdLUHcwQi9nVGZNN0VJQUxsSFovNGV2STVqelZvKzRPbEJ3VDdICk5sL2xMRWJCK1phU0VtOEhYcmRPa3dleEErMjYyOHJUeW1ORXMzUXFhNVR5cVZ3VXdGdHc3YmYyUVJSenJFRkQKZ3lUbW94dDAwajkyNjBFNkEzU1dRc1Z4MW5IVngxVGpTSkdYdlFNUFp4eENvQnhidkJWY2dtUjN2Y3ppeDZNUgpYemNnMjVhOGZJbjEraGM4S1RmZ1BhaTRjZjZVb1VrMnp0dUdDVFVYRDJqL3BBb0xHTnVRY0RSL0x2UlFwY2pmCjdVYkQ1YVNsMGRZVDdqTmRUV0RGSk01cFhVcVZYejhlTHA4MlRTdU1DUW5jYVhDT0VseXV6eVFwY0NhRUQ0WkMKNFc0dlk5SXpqYWhJRHVrQXpaT3FtNTdzMiszd3gzdjZkUVVTRkVNM01YY1pGSW5IWTNaWDRDMVM3ZU9MbE5VPQo9VEY3eAotLS0tLUVORCBQR1AgU0lHTkFUVVJFLS0tLS0K",
			sc: StreamClassification{
				Format:  CryptoMessageFormatPGP,
				Type:    CryptoMessageTypeClearSignature,
				Armored: true,
			},
		},
	}

	for i, v := range vectors {
		t.Logf("--> Vector %d\n", i)
		r := newStreamFromBase64String(t, v.msg)
		sc, r2, err := ClassifyStream(r)
		if err != nil {
			t.Fatalf("an error occured while stream classifying (%d)", i)
		}
		if sc.Format != v.sc.Format {
			t.Fatalf("Bad format (%d)", i)
		}
		if sc.Type != v.sc.Type {
			t.Fatalf("bad type (%d)", i)
		}
		if sc.Armored != v.sc.Armored {
			t.Fatalf("bad armored value (%d)", i)
		}
		assertStreamEqBase64(t, r2, v.msg)
	}
}
