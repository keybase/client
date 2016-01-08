// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
			msg: "lahTYWx0UGFja5IBAADEIC6r1c4gyWzcZtxcw5FNkW3nsNlICy0b2c4MS2CDy6B1lpLEIHbpbw1BkGrSZ6fusAZpVKe0ykCJ4k4bmfDRE9tSdX55xFXV4s22/jZCuxRZ2IDAuO7CYfVf/fPCgBPTpOVyagHqHWJoAq+rYOBgTykAHGF6H/StHIwRC65fcvti0Wv+tNltWoCdaLrMxTvW1eQNZgHGoVhUfY28ksQgXA3zoIr7fA+j/Ysq7gL0ktxoWVORHXzHEVW1UPST+z/EVXROSkyK6WIE9YoODALU85OYIxS/Dk3uPNBlGoyDhJfaN1vPdlfZV7E9dNEDlTG5TM3wer2GwQ5fQuzf603Msur4V+fGL/uQRftgDFcqE+0DByHgReGSxCAPNLkUhDCU7N3Rz1g6efazDv9LOGMrtSK3BQfw0hWNUsRVWz60iDhgQNARXQphSE8qc/aLELTtgg24JQkt3SLrclSz3qn5YQtUtvpCqiGicrkWP2whH/yCeJv7f/SsX9gZfa25Y5muQ7vj3JlEYAJqi+snibWLoZLEIJwNQ8vxt737snnW7cf32eH44kBIlLcMsrrNmQJaGfhPxFVg24GI9CrnKgHH8ovRtELLjDs7m2aEBEXxZSElpBmQU+fx/XEYSZnWL4V9dc/56D73UYNA76MVNo/f/E8JbpyqpOT80Py4nM1/ljB3FtfYWHYg20FvksQgHPc0crnWllRm6wQtn/A5jxI7ahe+WCAdVrL765nbE2vEVcMvGaKduwsxn9b4WSQ/N1Ju4jZzbpt99kabgX2seQG/gQmSyv5NL5gT8xA3CDzcTuPXodEC2kTHyv+oM99bPcIVSipZXdMpxsKxvB5ZPrmDaFuWFRCSxCADg1FPyoYv/sYg4F3tiaiTCZddKao3c6W5bP761deWGsRVM828GF+6ABENZxjcwU+5w49L8C7HfjiLdU1CoF6eE7q4/PjGzJcbdjpIdtsmk3vph0k5y/Dy6uQGVc0NRrrqM7j2YcpTrYuQ/F5qTvYyA3yeMJ07bZKWxBDhYeMf+tTHbTOmpmf/GTvAxBAOcUx3xbnR+Yb8wU7ehtCSxBBvmaxTHqQGeTAzCxvKadztxBD8bnt9jZHbTbF668jqPvbpxBBPUAf3thRAl+cq/DkpS1L7xBCpPKXzDs12EJdj/9lWYcdyxCbpKRkpckguM5om0p14umG++r8UqsVo/jQjDK2eD/o6B4Fch9RU2pKWxBAg5OBFGHLeTImBZ09ev1sbxBDb3WjwRs4allg7pi/Ugv6zxBC78DZxmqIdE/mHpASzswH7xBAhlAu5cwsPzB7iAaT7P1WrxBCAmrUw5M25TNqiLp5m3QYzxBCEnOUyUgdyW85pP6a9mOSixBBZBTq5Whp1VjjzwELMOhlc",
			sc: StreamClassification{
				Format:  CryptoMessageFormatSaltpack,
				Type:    CryptoMessageTypeEncryption,
				Armored: false,
			},
		}, {
			msg: "QkVHSU4gS0VZQkFTRSBTQUxUUEFDSyBFTkNSWVBURUQgTUVTU0FHRS4KClpVSFJIY2tmOVZKNmljaCBiS3RoY2Y5bUpKYTRlcWggMHFjQ3FvSmk1SFl2RnN3IExKT2xoa2VWbnExNDRzciAxV0tiUFNOUjV1TjFqNmYgZmdnaDlBN3NMTDYxV0dFIE9xT0NGdldhSUxlQWR6NiBKYnFEZ0V5NG9FZVpqdHAgdzN2NXhKOTQ1cEwzNjJKIHpnQWI4a1BvVVhOamdOTSBpSXFrdmtmaDIxbmRQZE4gTkF3aUxFbjAxZDNOT3NHIFR6S2k4a0kyYkRISGNZYSBvb1RnMzBqY005SEdadUwgNXBURmRzNHFqQTVPNm4zIDBTdGRCRWNBMkZaUW1BbSB6Y2RpVDhRUTV2dGpRUFkgeHBZTEJIbkZmREhHUE1EIDVTbzJWQ25mZzFvQXhMViA5MjZaM21zYkJ4YU05MDcgOWE0amFqa1I1aEhlVEdQIGJ2d29kZ056SUVKbXRrQSBsN2xvOGhwZ0NhZVIxWW0gcGs0eFdDb0o0TW5hSEJkIFMzdTB3TXlMVDJ1TWZwbSBDS2RFaWRJbEZrY1YxZ3IgS3RGRXB6ZVhlYU9IRHlRIFpaTFFUZks3VjBtRUtXZCBVZlZYeWlselppaE9tMzIgUnFQd05VN1JQaXIwMWc3IGFTcXc4eXZhanRxUTJRSCBhRUs1S0hSNDNGaFpxYmsgWU9kUGhoaHNpd0V5aVBBIHlPZ2h5MVhDVlFTdWtTTCAxbDVtYVlTYkQ1em9WWE8gQkFRb1JrR245MnlBRWlaIGcwSkJCNUZVZHJ6cTI1RSBhczhna1ZVOThlSG4yRXAgdjNYekZlZk1SZ1NLejhVIEc5SkN1Nm5uY0IwOGp1TSBzVHdzaGV3RWh1alhQbGUgMDhyQ0VVaVVDb1cxdUdTIDlvSkFZeWJrdXRCYVp6WiBjdWM0YlZ3ajJjNTE5azQgSzE5Yzhra3JrQmhmYlo0IGRGalJmbHEzdjBySm4yRSBmZDI3U2xaU1J2dlZSUjUgUWNqdTY4cHBsUVlLaHNKIHd6UndaS2dzQjhjaTRERyBscmZlSGJvMkxNcWpyYnUgaVlzRVZyNzRkYzZwTkFsIHE3c2ZFMHl4cjY0dEk1YSA5QVFaSmZmejFsNTd4elcgMUs5YTg0NnRHM2tQNjhuIHVwUnR6S2JZb0FIcHJoYiBIOWNvSk1Mc2k4eVNaYzYgMXIxZHYxMFE2UnNsS1ZWIGhhRFZhQTJjVXJCbmZ4USA0cEtYSEdsNWp5UnZDc0IgTHJUcEZxU2NvMGVzWGNtIEhaWXJDZkxKRDF3MTFpeSB4Y0k3Vkl6M3o3bWRaMXUgSGpvTDd4M1YzN0xTMXRCIHAzQjJ6Z0FoeU5Fb3VBcSBoc3haYnlncWhhNWROY28gMWtiV2tBOFFvR2k1QU1EIG9zbzJ4R2d1d2tBVjQzWSA4VERJQ3AySXpESGl4NXQgaTJnQThsZUFCQUR3eHFMIHdNWFo1aGx6TFFhV2o5ZiBsVlRVQjJJVFVXa1VjeVIgalo0Nms2S1M5VGppNDFkIGxzcG9WQUhqZHh1QXFlQSBmZ2wwaFdxbWt6RGVuNkIgM2VLQVpyTlQ2YWEzZE4wIHdHZllRODhiN0Q2cGxmRCBzd25rNUF0bHJDakNGNVEgUWh1d1prYTFJR0VVYjZtIDU2OGN2bDZOOUdzeTZnZSBuOUwxbUZNemtMVW1xZnogR0dOTjlwTGdKaGFVcmpvIHJhZjdqSEJ5dVAwY09QViBjZEw4VXFET2xJY0hlYU8gNW5vTGlmQnczSm1oaXoxIHlEWkhOMUptak5oU1FEbCBwMEJNQUZUVzd0N240Z00gWmVObW9vWnZUdkI3ZmxiIGhYeUJUTllmVkJmTFdRayBSeVJhT0VoTldVVXVKaHkgVXBJWWtFYzFGRHpaMGJZIFBIUjJmYzd4bGp3dkZTRyByNHFYWkhva1NkSTN1cWcgTFJkdXNmR21laEppM2lNIHNlcEtENnRRRWZzZ3ZQNCA1dFh3azVQREEwRnlXYS4KCkVORCBLRVlCQVNFIFNBTFRQQUNLIEVOQ1JZUFRFRCBNRVNTQUdFLgo=",
			sc: StreamClassification{
				Format:  CryptoMessageFormatSaltpack,
				Type:    CryptoMessageTypeEncryption,
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
