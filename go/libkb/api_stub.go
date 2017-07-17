// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package libkb

type StubAPIEngine struct {
	*ExternalAPIEngine
}

func NewStubAPIEngine() *StubAPIEngine {
	return &StubAPIEngine{
		ExternalAPIEngine: &ExternalAPIEngine{BaseAPIEngine{clients: make(map[int]*Client)}},
	}
}

func (e *StubAPIEngine) Get(arg APIArg) (res *ExternalAPIRes, err error) {
	return e.ExternalAPIEngine.Get(arg)
}

func (e *StubAPIEngine) GetHTML(arg APIArg) (res *ExternalHTMLRes, err error) {
	return e.ExternalAPIEngine.GetHTML(arg)
}

func (e *StubAPIEngine) GetText(arg APIArg) (*ExternalTextRes, error) {
	if body, ok := apiStubs[arg.Endpoint]; ok {
		return &ExternalTextRes{Body: body, HTTPStatus: 200}, nil
	}
	return e.ExternalAPIEngine.GetText(arg)
}

var apiStubs = map[string]string{
	"https://gist.githubusercontent.com/kbtester1/9f6c0787825f4fcc81f7/raw/1ec930037d05bbd2496e862a023d69ae6cc4c215/keybase.md": `### Keybase proof

I hereby claim:

  * I am kbtester1 on github.
  * I am t_bob (https://keybase.io/t_bob) on keybase.
  * I have a public key whose fingerprint is 91FE 9B24 EF67 06B1 F789  8F20 59A2 A43F 8B73 1F29

To claim this, I am signing this object:

json
{
    "body": {
        "client": {
            "name": "keybase.io node.js client",
            "version": "0.7.5"
        },
        "key": {
            "fingerprint": "91fe9b24ef6706b1f7898f2059a2a43f8b731f29",
            "host": "keybase.io",
            "key_id": "59A2A43F8B731F29",
            "uid": "afb5eda3154bc13c1df0189ce93ba119",
            "username": "t_bob"
        },
        "merkle_root": {
            "ctime": 1424293533,
            "hash": "976e2bd970e1375d2a4c906ddef53e015e4bcbee8d87f7d1992e0344abe36f3d2e622efa9d2715d3350b7be5e981357d7e9c93db84c041210df98a3747c84073",
            "seqno": 5
        },
        "service": {
            "name": "github",
            "username": "kbtester1"
        },
        "type": "web_service_binding",
        "version": 1
    },
    "ctime": 1424293535,
    "expire_in": 157680000,
    "prev": "4364d76671c1a7cc4d4597aee4c534ea4086e3831e867010ae0509832608c1d0",
    "seqno": 2,
    "tag": "signature"
}


with the key [91FE 9B24 EF67 06B1 F789  8F20 59A2 A43F 8B73 1F29](https://keybase.io/t_bob), yielding the signature:


-----BEGIN PGP MESSAGE-----
Version: GnuPG/MacGPG2 v2

owFdUltsFVUUvb3YgmgDojGiVcuA0YTbm/OcM6etFTRp/OJDjD9qrufM2XPvtHTm
OjOtlJsGH1Hsj8EHvhptaEET8AMlPAwtGnkUQ2orwWiCjcRACNEYw4cBNMaZmxrB
87Wz99prr3X23tq8IJdviJ5ov9T15URrw8mLOvf4ub9Ha5YOzaDVXrPcDT4ESRYF
qg+sdqsXBrWKoeiHrUFooNgTt85jCtYARLEfBikKFUWRW0OFDJ41e35Qhqga+RmX
JbEHUhMGni2QrbEnHOl4BHGpiGLUc7Sg2CMypayEcXLdVKvOWfJNmuVyLVnLaLfz
cIrvruP76wXlaQ5GUcyZdjF1sfEQdqQLkmqFcR0YQzRvKSnpUGdi+yDq3QClKAzr
jt3Ez+qYEUYk5ZSmclRcyQwIG4g2UiDAVHCTqnYlso0Bj1NAmEM6VwM4xhGeMFhK
AogypjRQ26OGgE0IeEoaIjA3lHKkhQYO0sGUCyNAupIa7TAXMUwwMp50FBVMuA5D
gqb6Y3g2CK12PpSF0YDvwjVLKvtJpV9f77JXJxAnEOHMaTJYzXLPgS7Nd5e0Hxg/
GC1fu0ecQv//C7xgwcaqH0HJzxBc2A5KX8GqRjCQcjJqMyNsW2AXK+G6zDAuhQJg
LqcMFEOODdShGJx0+xgpQBxJhxIbOemi0H/eSKpTlVPK2C8HKumPwBoabmi5IdeQ
zzU15rNDzS2+cem/17vn1UW5mdnOw317u/atXL3wIPrrapM1Jtcc3o4fqu76oXLi
44svfLPgzEenu34abxv+896Ryzuu7Hn0tml993vrF0c/Tk183vlmcNPkp9M7F47d
9eLZn99vemvm2zeO/fp0bQJdngrWL227OnhhE8R/3HrifMfrIx073jkw9ciTMz2F
VeXKpfOdq3p63hWj418s23pqfNvIgQ+OzW3e+N2hJS/lT52+0la6ffjcTMuuoOOZ
LWvQfV/3rXtwUfMts3P3HM0Xx/Yf2j7dff/yWuOR/trumxuf33cwv2Xg9xXo5BJy
58hTHx59eXb5Z78dSTZ/9djq/IXJ45/sbd55R7Ltte7Zt385/sqmydaWeP/cimX8
zAPf187+Aw==
=Zpkd
-----END PGP MESSAGE-----



And finally, I am proving ownership of the github account by posting this as a gist.

### My publicly-auditable identity:

https://keybase.io/t_bob

### From the command line:

Consider the [keybase command line program](https://keybase.io/docs/command_line).

bash
# look me up
keybase id t_bob

# encrypt a message to me
keybase encrypt t_bob -m 'a secret message...'

# ...and more...
`,
	"https://gist.githubusercontent.com/kbtester2/3cbaad55bfae3ed948d9/raw/0c5a148629e3f405ed8d640b8fa432a073da56c8/keybase.md": `### Keybase proof

	   I hereby claim:

	     * I am kbtester2 on github.
	     * I am t_alice (https://keybase.io/t_alice) on keybase.
	     * I have a public key whose fingerprint is 2373 FD08 9F28 F328 916B  88F9 9C79 27C0 BDFD ADF9

	   To claim this, I am signing this object:

	   json
	   {
	       "body": {
	           "client": {
	               "name": "keybase.io node.js client",
	               "version": "0.7.5"
	           },
	           "key": {
	               "fingerprint": "2373fd089f28f328916b88f99c7927c0bdfdadf9",
	               "host": "keybase.io",
	               "key_id": "9C7927C0BDFDADF9",
	               "uid": "295a7eea607af32040647123732bc819",
	               "username": "t_alice"
	           },
	           "merkle_root": {
	               "ctime": 1424293518,
	               "hash": "fd557b6743f705d3672e919102a78b2a2371af34735bff33db524c5baecda8fd61c6c625ecc1ce1f7a2ed435e1c82c9a6c2ff861782daf86a9dd6594c278ac1e",
	               "seqno": 2
	           },
	           "service": {
	               "name": "github",
	               "username": "kbtester2"
	           },
	           "type": "web_service_binding",
	           "version": 1
	       },
	       "ctime": 1424293523,
	       "expire_in": 157680000,
	       "prev": "68700c8bf6c727934f126c5dcc5ef4dacfe450663435065e7930f1f87d3b5333",
	       "seqno": 2,
	       "tag": "signature"
	   }

	   with the key [2373 FD08 9F28 F328 916B  88F9 9C79 27C0 BDFD ADF9](https://keybase.io/t_alice), yielding the signature:

	   -----BEGIN PGP MESSAGE-----
	   Version: GnuPG/MacGPG2 v2

	   owFdkm9oVWUcx++uzlhcIUTsRV6yUy8mXOZ5nuc8f840y3ZRYhAhijrIw3OeP/ee
	   dnfv3Tlnm3NbRJYRWRg6wvLFpmDBpmVBBHNhL0yimDBZkqKBhJbppg2j8LJ6zlik
	   nVc/nufz+35/3/N79i9dlErXTc86qPPR/R/Uffern9ry89yBPsuvyF6ruc8SpUCV
	   46Qq8w5lNVvtqtfnkWoKKqvKFamaXo5WLTA5q1uFUVApG8puok3YGsgleNKsg3JB
	   hdUwSLQsiCjS0mauhkwjyFxAfMa06wrqQipsX2rJpXaNZLESxQ+4WvOaXiDNqduS
	   8C32c/mN+Q35jQnfNX8BXcypUpzYlBsD27GJQ0FiC33BwDwYqXAhUuzxUiBUMm6H
	   CttLygsrlfnMIg4SAjjQgS7CgJmBeFQ0PVpiTH1CHaSpjSUiFCoXuMCGnDIfcuMF
	   jLVDEfa1Rkj6GDoC+1wJyZmWBAgiCMRKCCAU0JRDJR2EFRAMCpcTAbVmBFAGJTcF
	   d6Uk2HUEpIwLoEyCSHWWK1YzHEjKsDtJ8N+aCkFc7PIfzNnuxyqKVQiTpHFvNTnr
	   Ub630O35QVkOm0Xdv0lg0P/9BYhyltpVDULlBQmBKWG2+XJWNVTdRpMwatuC+ZoI
	   CqmLHA0gEVgKgZV2JBdaOdgmBJm8NsHKILYGmlGJfIwQui+bmZMXjGQUFMo87grN
	   kt6qW7k4VZdOLalPJ0819XDDI/++X/7CQ7WlrbWpzGOTlz8+8ea13MVNeydfv/Ph
	   6GBrJnP87HDIhnpq3/+GXnp/6pWx5fJptXd8x4YxOFK4UF8cLA4suz15cfWz3/yx
	   fOhUfnDdjWNP7s7woYls6VBf6/aZZ1ZeQPtevf5R7fq3vxxbll39++5NnZfW1cb+
	   yoxca+sfLJ3sp2/frd/ZcqTh9KWZT7YcfWpf40TwxOiajPf3RGPH5htz711d3//V
	   3PFd538C09s/XZudGfV+PPfDi4fHv5je4VWH2+6VXkuPzKzI3zxzSH82e+XLq1MH
	   Fr2x9Wv4zvptYE999vK7Vw5Otjyfnv3zVOPpe+MN9pm2xztOznahW9lbny8uumfv
	   nj+3p+dg+h8=
	   =iePR
	   -----END PGP MESSAGE-----


	   And finally, I am proving ownership of the github account by posting this as a gist.

	   ### My publicly-auditable identity:

	   https://keybase.io/t_alice

	   ### From the command line:

	   Consider the [keybase command line program](https://keybase.io/docs/command_line).

	   bash
	   # look me up
	   keybase id t_alice

	   # encrypt a message to me
	   keybase encrypt t_alice -m 'a secret message...'

	   # ...and more...

	   	`,
	"https://gist.githubusercontent.com/tacoplusplus/d21a10f2d7f6447dba7d/raw/cfeb4ffbec5f555bddf4ce23ea43bcb7613c6577/keybase.md": `### Keybase proof

	   I hereby claim:

	     * I am tacoplusplus on github.
	     * I am t_charlie (https://keybase.io/t_charlie) on keybase.
	     * I have a public key whose fingerprint is 6FB9 1F01 1D89 542A C1C0  947D DE0F 9384 9129 7B7F

	   To claim this, I am signing this object:

	   json
	   {
	       "body": {
	           "client": {
	               "name": "keybase.io node.js client",
	               "version": "0.7.5"
	           },
	           "key": {
	               "fingerprint": "6fb91f011d89542ac1c0947dde0f938491297b7f",
	               "host": "keybase.io",
	               "key_id": "DE0F938491297B7F",
	               "uid": "9d56bd0c02ac2711e142faf484ea9519",
	               "username": "t_charlie"
	           },
	           "merkle_root": {
	               "ctime": 1424293546,
	               "hash": "ad25d6ffda2195229175f7199e6fca799b36ca03523c2fb8030f9b81bb185ea7a4babfdbf7650e80a0ecb015a0bfd6382fe42b11b4914aff5812d3667cb4cd33",
	               "seqno": 8
	           },
	           "service": {
	               "name": "github",
	               "username": "tacoplusplus"
	           },
	           "type": "web_service_binding",
	           "version": 1
	       },
	       "ctime": 1424293548,
	       "expire_in": 157680000,
	       "prev": "1dd32ec2e951f642d6f88ac93f07c69b1195d63d9011cfe5ff14a889c8af3d54",
	       "seqno": 2,
	       "tag": "signature"
	   }

	   with the key [6FB9 1F01 1D89 542A C1C0  947D DE0F 9384 9129 7B7F](https://keybase.io/t_charlie), yielding the signature:

	   -----BEGIN PGP MESSAGE-----
	   Version: GnuPG/MacGPG2 v2

	   owFdkl1sFUUUx+9toUJFPpWibQJsUnngWmZmd3ZnClIw5SakxgipNJCY2/m83dK7
	   e9m9t7aBykdoCA986AMoJCQaEaKGNEQrFF54oMYYDOGjDSRqNTURDST0wfigjbNN
	   QWSTTSZn/uc/53fOOfpcZaoifX9ieI/c/XFd+rt7PNU6PvnFTouHstdq3GmJLl8F
	   peQUsIKyGq3tqpezWDX44bIglKqhM142rclY3SqK/TAwKtDgNWCrL5PIk2TtB3kV
	   FSM/8bJczSnUAEJJKHYQE1AA6nhSKqCpTRwKEfW4p41lRxiX/veqNeWZ86WJNm8A
	   2cf617ysuStPXVCJXS6BAMYbeRAq6CDNtEMcxSiGNBHGKppGKuVEB4sMRFJwQUXb
	   u1QuCsMpalHyE43JdxC1seOakljcYbKYRFi6WkuGIMUIUehh7UFKlasF8yjltisY
	   sDGyBdKcANvAcQI5hwQr5jGHM64l156LgSKAASU4gJgBE3VtgrRyEIeQGzyHaY0J
	   RNJ2XU9wR0jbNgyx2hGEViPpS45Rty/UE4PK+6WOMn+KlImw2FWOkz+BLfUWk/A7
	   iuemDT7NcT+QZlpPjhMa6dONIBlL9RT9SOX8RIE9lwDzZaxipLqNJ5TSRkogZfqt
	   XQeZVhHCBLU18IRLDRg17bMlNWsgtMJaG0pCqCBM2xI7/+EhUyfLG8vYzwesVI7M
	   nA6m62ak0hWpqpkVyb6mqmfPf7TE2bnP/FNz6spoW/7MxuuvV+vdnx/tuzerOavb
	   g9biX5fw0E+1mwuHXm4Zrf96zeaNrcOF5z8cz/YvvDv77Ok7P3feHx+67v+2ItP+
	   +yJn4tZ7uPrNW6uWDsVNY3VvjO36oVo9e7vml4UvTdSom1fPozX9n51/9/hg+81D
	   cwdvvFA70Pnwx5P5lauvztk0NnCjJ1y9b337g7Y5k3fK9VVbwbxX/i5UfZk+S/9Y
	   UR5+66MXt7wfq707vs83rxu5fKLlYH3TmV8Hl3z7Dd6S3fPBCDs2/8SBnrUXYRXa
	   9ueS28sPj26r3Ftb2XVh17zl15oefvWgtaXtWt3xFq/n7YHT5z65sKB568j+/iPr
	   XhUbGicXV/4L
	   =2qH+
	   -----END PGP MESSAGE-----


	   And finally, I am proving ownership of the github account by posting this as a gist.

	   ### My publicly-auditable identity:

	   https://keybase.io/t_charlie

	   ### From the command line:

	   Consider the [keybase command line program](https://keybase.io/docs/command_line).

	   bash
	   # look me up
	   keybase id t_charlie

	   # encrypt a message to me
	   keybase encrypt t_charlie -m 'a secret message...'

	   # ...and more...`,
}
