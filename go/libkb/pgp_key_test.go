// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"
	"testing"

	"github.com/keybase/go-crypto/openpgp"
)

// See Issue #40: https://github.com/keybase/client/issues/40
func TestPGPGetPrimaryUID(t *testing.T) {

	armored := `
-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: GPGTools - https://gpgtools.org

mI0EVUubbgEEAKvIPrcQksiZW/dIX3sfZCSxfZqS8nojN/307rZ7323oAPTG6W7Y
EHfdgpKxUfMrdiNiWtujbybT8XUFhZwuPZF06BMIVmXESBr7rHLZ1Up41HmjvTtR
n1ejyy/tMl9zjydTIxjXsML9mPe3k3KVlrfgrbvadeM6PdYw+oE8tLZRABEBAAG0
IVByaW1hcnkgUHJpbWFyeSA8cHJpbWFyeUB1aWQuY29tPoi8BBMBCgAmAhsDBwsJ
CAcDAgEGFQgCCQoLBBYCAwECHgECF4AFAlVLm6YCGQEACgkQ5+9u0rO5NRk/4wP/
WBY3/C1keVxQMdma/F6l+yeP8SQvzqTLWZKRu1tPyi2DWYu8HnVw5/Upazj/UC8u
4Q7OzBsU0dn+5TUrwSfuTATY7OOSgWo/Nf++rqTU2z4h8kmV/qelGTrBKvshAEMk
/9ejJhPcErXocHHkAGCB+V4lSC70lBsAYoriEg2jmvW0J1NlY29uZGFyeSBTZWNv
bmRhcnkgPHNlY29uZGFyeUB1aWQuY29tPoi5BBMBCgAjBQJVS5uBAhsDBwsJCAcD
AgEGFQgCCQoLBBYCAwECHgECF4AACgkQ5+9u0rO5NRmZzwP/UnO2OBcaT3doVDbz
o246Ur3M/USz9XVhBMabCpd4iANXswi/9iJyFW0rMn3DXAUO3Qj8yh/077FfMqUj
srcmbC4qtscd3X1V7hQ4rOsiEghUu2ZG8XsFxBh01NpDYxrTXQfmJeegUMAirgrA
r8WBLqMoZo8TarCDCw/6ygTxV6y0JFRlcnRpYXJ5IFRlcnRpYXJ5IDx0ZXJ0aWFy
eUB1aWQuY29tPoi5BBMBCgAjBQJVS5uVAhsDBwsJCAcDAgEGFQgCCQoLBBYCAwEC
HgECF4AACgkQ5+9u0rO5NRlZegP8Dl2IGu3WwF4w2Qxj/WzhTeiaLQoTzEsF0IPy
+f+IBO/uC/5bw/b3uNAhGK1wK3hy77II+py2x7/EvJAz2w1Ua9IMD6YuZBQaSzwV
tRhoHOnptdxLNDZPvZVuPl8G6p4yKLqelGymtdtpkObz9w8f+KTcieEUVeM7HbI8
/dwF7da4jQRVS5tuAQQAy0uPwJBoQeXz/uv5ifdXJG39cYFTaONQxa6U3/Wtx3oV
ibdqyygmFliHJJJyx0wjMohVbDT2sl8bHr0gpZxnkDF7+Gmcwcn/ohfKf0h7hrmL
W4nGNdiQiD6QZZz7ebEBuqzUmkAYg33lsYZ8MLI6wLK3sMmzA468di06YUa9eksA
EQEAAYifBBgBCgAJBQJVS5tuAhsMAAoJEOfvbtKzuTUZMFMD/28lUOflsdcLvJyL
L22yGWeoUlKMQmdbreSUo3Ibcdkpsy9ZHDHxWRBN5s/cxHtX6nna5IeHSNIdDruX
HKfiyXs8709e067vsE5FCTMvZCq4vt/lkEJ59xn58QBfEILMwQDNLqVGyA54MPwh
+NwHX7807fKQwvqyVixJoZ3yS6Js
=RH/W
-----END PGP PUBLIC KEY BLOCK-----
`
	expected := "Primary Primary <primary@uid.com>"
	for i := 0; i < 100; i++ {
		key, _, err := ReadOneKeyFromString(armored)
		if err != nil {
			t.Error(err)
		}
		primary := key.GetPrimaryUID()
		if primary != expected {
			t.Errorf("Expected '%s' as a primary UID; got '%s'", expected, primary)
		}
	}
	return
}

func TestOpenPGPMultipleArmored(t *testing.T) {
	// openpgp.ReadArmoredKeyRing only returns the first key block, despite what its
	// comment says.  Here's a test for that:
	r := strings.NewReader(issue454Keys)
	el, err := openpgp.ReadArmoredKeyRing(r)
	if err != nil {
		t.Fatal(err)
	}
	// len(el) should be 2, but it's 1:
	/*
		if len(el) != 2 {
			t.Errorf("number of entities: %d, expected 2", len(el))
		}
	*/

	// we'll make sure that this bug still exists in openpgp, so if it ever
	// gets fixed we can take appropriate action:
	if len(el) != 1 {
		if len(el) == 2 {
			t.Errorf("openpgp.ReadArmoredKeyRing multiple keys bug fixed!")
		} else {
			t.Errorf("openpgp.ReadArmoredKeyRing bug changed...number entities: %d, expected 1.", len(el))
		}
	}
}

func TestMultipleArmored(t *testing.T) {

	// ReadOneKeyFromString will return the public key for issue454Keys
	b1, _, err := ReadOneKeyFromString(issue454Keys)
	if err != nil {
		t.Fatal(err)
	}
	if b1.HasSecretKey() {
		t.Errorf("ReadOneKeyFromString returned a private key for issue454Keys.  Expected just the public key (the first one).")
	}

	// ReadPrivateKeyFromString should skip the first public key in issue454Keys
	// and use the private key that follows it.
	b2, _, err := ReadPrivateKeyFromString(issue454Keys)
	if err != nil {
		t.Fatal(err)
	}
	if !b2.HasSecretKey() {
		t.Errorf("ReadPrivateKeyFromString returned only a public key for issue454Keys.  Expected a private key.")
	}
}

const issue454Keys = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Comment: GPGTools - http://gpgtools.org

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
2jAapEr4VzIbew==
=pyUo
-----END PGP PUBLIC KEY BLOCK-----
-----BEGIN PGP PRIVATE KEY BLOCK-----
Comment: GPGTools - http://gpgtools.org

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
LpRtxqDTDVA6H/R+dqEhg/ni2jAapEr4VzIbew==
=bXrj
-----END PGP PRIVATE KEY BLOCK-----`

func TestReadOneKeyFromBytes(t *testing.T) {

	t.Log("If this test panics for you, then you need to update github.com/keybase/go-crypto/openpgp")
	// found by go-fuzz:
	// (errors are ok, panics are not...these all caused panics with an older version of
	// openpgp)
	_, _, err := ReadOneKeyFromBytes([]byte("\x9900\x03000000\x01\x00\x00\x00\x030"))
	if err != nil {
		t.Log(err)
	}
	_, _, err = ReadOneKeyFromBytes([]byte("\xd1\x1b\x0000000000000000000" + "000000000"))
	if err != nil {
		t.Log(err)
	}
	_, _, err = ReadOneKeyFromBytes([]byte("0\xd1\x03\x0000"))
	if err != nil {
		t.Log(err)
	}
}

func TestPGPSubkeyWarning(t *testing.T) {

	const missingCrossSignatureKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Charset: UTF-8

mQENBFMYynYBCACVOZ3/e8Bm2b9KH9QyIlHGo/i1bnkpqsgXj8tpJ2MIUOnXMMAY
ztW7kKFLCmgVdLIC0vSoLA4yhaLcMojznh/2CcUglZeb6Ao8Gtelr//Rd5DRfPpG
zqcfUo+m+eO1co2Orabw0tZDfGpg5p3AYl0hmxhUyYSc/xUq93xL1UJzBFgYXY54
QsM8dgeQgFseSk/YvdP5SMx1ev+eraUyiiUtWzWrWC1TdyRa5p4UZg6Rkoppf+WJ
QrW6BWrhAtqATHc8ozV7uJjeONjUEq24roRc/OFZdmQQGK6yrzKnnbA6MdHhqpdo
9kWDcXYb7pSE63Lc+OBa5X2GUVvXJLS/3nrtABEBAAG0F2ludmFsaWQtc2lnbmlu
Zy1zdWJrZXlziQEoBBMBAgASBQJTnKB5AhsBAgsHAhUIAh4BAAoJEO3UDQUIHpI/
dN4H/idX4FQ1LIZCnpHS/oxoWQWfpRgdKAEM0qCqjMgiipJeEwSQbqjTCynuh5/R
JlODDz85ABR06aoF4l5ebGLQWFCYifPnJZ/Yf5OYcMGtb7dIbqxWVFL9iLMO/oDL
ioI3dotjPui5e+2hI9pVH1UHB/bZ/GvMGo6Zg0XxLPolKQODMVjpjLAQ0YJ3spew
RAmOGre6tIvbDsMBnm8qREt7a07cBJ6XK7xjxYaZHQBiHVxyEWDa6gyANONx8duW
/fhQ/zDTnyVM/ik6VO0Ty9BhPpcEYLFwh5c1ilFari1ta3e6qKo6ZGa9YMk/REhu
yBHd9nTkI+0CiQUmbckUiVjDKKe5AQ0EUxjKdgEIAJcXQeP+NmuciE99YcJoffxv
2gVLU4ZXBNHEaP0mgaJ1+tmMD089vUQAcyGRvw8jfsNsVZQIOAuRxY94aHQhIRHR
bUzBN28ofo/AJJtfx62C15xt6fDKRV6HXYqAiygrHIpEoRLyiN69iScUsjIJeyFL
C8wa72e8pSL6dkHoaV1N9ZH/xmrJ+k0vsgkQaAh9CzYufncDxcwkoP+aOlGtX1gP
WwWoIbz0JwLEMPHBWvDDXQcQPQTYQyj+LGC9U6f9VZHN25E94subM1MjuT9OhN9Y
MLfWaaIc5WyhLFyQKW2Upofn9wSFi8ubyBnv640Dfd0rVmaWv7LNTZpoZ/GbJAMA
EQEAAYkBHwQYAQIACQUCU5ygeQIbAgAKCRDt1A0FCB6SP0zCB/sEzaVR38vpx+OQ
MMynCBJrakiqDmUZv9xtplY7zsHSQjpd6xGflbU2n+iX99Q+nav0ETQZifNUEd4N
1ljDGQejcTyKD6Pkg6wBL3x9/RJye7Zszazm4+toJXZ8xJ3800+BtaPoI39akYJm
+ijzbskvN0v/j5GOFJwQO0pPRAFtdHqRs9Kf4YanxhedB4dIUblzlIJuKsxFit6N
lgGRblagG3Vv2eBszbxzPbJjHCgVLR3RmrVezKOsZjr/2i7X+xLWIR0uD3IN1qOW
CXQxLBizEEmSNVNxsp7KPGTLnqO3bPtqFirxS9PJLIMPTPLNBY7ZYuPNTMqVIUWF
4artDmrG
=7FfJ
-----END PGP PUBLIC KEY BLOCK-----`

	_, w, err := ReadOneKeyFromString(missingCrossSignatureKey)
	if err != nil {
		t.Error(err)
	}

	if w.IsEmpty() {
		t.Errorf("Expected a bad subkey warning")
	}
}
