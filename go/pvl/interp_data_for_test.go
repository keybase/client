// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package pvl

var sig1 = "g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgDF5p5xwkO9EIez5YMoECuOUAXvCPRctPH+sUNyTD23sKp3BheWxvYWTFAvJ7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwMGM1ZTY5ZTcxYzI0M2JkMTA4N2IzZTU4MzI4MTAyYjhlNTAwNWVmMDhmNDVjYjRmMWZlYjE0MzcyNGMzZGI3YjBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwMGM1ZTY5ZTcxYzI0M2JkMTA4N2IzZTU4MzI4MTAyYjhlNTAwNWVmMDhmNDVjYjRmMWZlYjE0MzcyNGMzZGI3YjBhIiwidWlkIjoiYmFhZDNkNDY0NWEzMDQ3NmQyZmE5N2U4MzY0NjY2MTkiLCJ1c2VybmFtZSI6InRlc3RlcnJhbHBoIn0sInNlcnZpY2UiOnsibmFtZSI6InR3aXR0ZXIiLCJ1c2VybmFtZSI6InRlc3RlcnJhbHBoIn0sInR5cGUiOiJ3ZWJfc2VydmljZV9iaW5kaW5nIiwidmVyc2lvbiI6MX0sImNsaWVudCI6eyJuYW1lIjoia2V5YmFzZS5pbyBnbyBjbGllbnQiLCJ2ZXJzaW9uIjoiMS4wLjQifSwiY3RpbWUiOjE0NDg5ODgxNTUsImV4cGlyZV9pbiI6NTA0NTc2MDAwLCJtZXJrbGVfcm9vdCI6eyJjdGltZSI6MTQ0ODk4ODEzNywiaGFzaCI6IjAwMjhkNTY2NDczNmM4NGEzMGFmZDZmZmI4M2M4NGYzNjk2YjVlZTNlMmUzYjMyNmMyODY1ZTViYWIzYzAyYzFjY2U5ZGI2YTM3ZjU1ZWU1YmNiNmNlNzAzODY1ZmViZTA2M2U4YWFhZGE0ZWM5ZWJlNjI5OTIzYTA3OWRhYmUzIiwic2Vxbm8iOjMyODE4OX0sInByZXYiOiIwMzlhMzhiZTVhMjAzZWU0ODk3NDQ4NDMyMTMxNmFkMTJhOGI4ODQyNjZhN2UwMmM5MzI3N2YyYTEzNGY0ZDBlIiwic2Vxbm8iOjYsInRhZyI6InNpZ25hdHVyZSJ9o3NpZ8RAVRhCtS9bupx1LdKkuXreFzRQyOyKTslTDpb0rGbx07XSZh7/vj1AZw3eLJnJsrc9DujP0gdgYjlz4i2DNLacAahzaWdfdHlwZSCjdGFnzQICp3ZlcnNpb24B"
var sig1IDmedium = "9JHQ8ZNOFRORQUpmH0jLbNbFClOccMEghH5lmQsP4Sk"
var sig1IDshort = "9JHQ8ZNOFRORQUpmH0jLbNbFClOccMEghH5l"

var info1 = ProofInfo{
	ArmoredSig:     sig1,
	Username:       "kronk",
	RemoteUsername: "kronkinator",
	Hostname:       "kronk.example.com",
	Protocol:       "http:",
	APIURL:         "https://rooter.example.com/proofs/kronkinator/5.htjsxt",
}

var infoBadDomain = ProofInfo{
	ArmoredSig:     sig1,
	Username:       "kronk",
	RemoteUsername: "kronkinator",
	Hostname:       "kronk.example.com/foo", // Path in domain
	Protocol:       "http:",
	APIURL:         "https://rooter.example.com/proofs/kronkinator/5.htjsxt",
}

var infoBadProto = ProofInfo{
	ArmoredSig:     sig1,
	Username:       "kronk",
	RemoteUsername: "kronkinator",
	Hostname:       "kronk.example.com",
	Protocol:       "spdy:", // Bad protocol.
	APIURL:         "https://rooter.example.com/proofs/kronkinator/5.htjsxt",
}

var infoBadSig = ProofInfo{
	ArmoredSig:     sig1 + "w",
	Username:       "kronk",
	RemoteUsername: "kronkinator",
	Hostname:       "kronk.example.com",
	Protocol:       "http:",
	APIURL:         "https://rooter.example.com/proofs/kronkinator/5.htjsxt",
}

var html1 = `
<html>
<head>
<title>proofer</title>
</head>
<body>
	<div class="twit">
	goodproof
	g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgDF5p5xwkO9EIez5YMoECuOUAXvCPRctPH+sUNyTD23sKp3BheWxvYWTFAvJ7ImJvZHkiOnsia2V5Ijp7ImVsZGVzdF9raWQiOiIwMTIwMGM1ZTY5ZTcxYzI0M2JkMTA4N2IzZTU4MzI4MTAyYjhlNTAwNWVmMDhmNDVjYjRmMWZlYjE0MzcyNGMzZGI3YjBhIiwiaG9zdCI6ImtleWJhc2UuaW8iLCJraWQiOiIwMTIwMGM1ZTY5ZTcxYzI0M2JkMTA4N2IzZTU4MzI4MTAyYjhlNTAwNWVmMDhmNDVjYjRmMWZlYjE0MzcyNGMzZGI3YjBhIiwidWlkIjoiYmFhZDNkNDY0NWEzMDQ3NmQyZmE5N2U4MzY0NjY2MTkiLCJ1c2VybmFtZSI6InRlc3RlcnJhbHBoIn0sInNlcnZpY2UiOnsibmFtZSI6InR3aXR0ZXIiLCJ1c2VybmFtZSI6InRlc3RlcnJhbHBoIn0sInR5cGUiOiJ3ZWJfc2VydmljZV9iaW5kaW5nIiwidmVyc2lvbiI6MX0sImNsaWVudCI6eyJuYW1lIjoia2V5YmFzZS5pbyBnbyBjbGllbnQiLCJ2ZXJzaW9uIjoiMS4wLjQifSwiY3RpbWUiOjE0NDg5ODgxNTUsImV4cGlyZV9pbiI6NTA0NTc2MDAwLCJtZXJrbGVfcm9vdCI6eyJjdGltZSI6MTQ0ODk4ODEzNywiaGFzaCI6IjAwMjhkNTY2NDczNmM4NGEzMGFmZDZmZmI4M2M4NGYzNjk2YjVlZTNlMmUzYjMyNmMyODY1ZTViYWIzYzAyYzFjY2U5ZGI2YTM3ZjU1ZWU1YmNiNmNlNzAzODY1ZmViZTA2M2U4YWFhZGE0ZWM5ZWJlNjI5OTIzYTA3OWRhYmUzIiwic2Vxbm8iOjMyODE4OX0sInByZXYiOiIwMzlhMzhiZTVhMjAzZWU0ODk3NDQ4NDMyMTMxNmFkMTJhOGI4ODQyNjZhN2UwMmM5MzI3N2YyYTEzNGY0ZDBlIiwic2Vxbm8iOjYsInRhZyI6InNpZ25hdHVyZSJ9o3NpZ8RAVRhCtS9bupx1LdKkuXreFzRQyOyKTslTDpb0rGbx07XSZh7/vj1AZw3eLJnJsrc9DujP0gdgYjlz4i2DNLacAahzaWdfdHlwZSCjdGFnzQICp3ZlcnNpb24B
	</div>
	<div class="twit" data-x="y">
	evil.com
	</div>
	<div class="twit">
	short 9JHQ8ZNOFRORQUpmH0jLbNbFClOccMEghH5l
	</div>
</body>
</html>
`

var html2 = `
<html>
<head>
<title>proofer</title>
</head>
<body>
	<div class="a">
		<div class="b">
			<!-- cow -->
			a
			<!-- bunga -->
		</div>
	</div>
	<div class="moo" data-x="y">
	evil.com
	</div>
</body>
</html>
`

var json1 = ` {
  "data": [
    {
	}, {
      "type": "useless",
      "data": "junk"
    }, {
      "type": "useful",
      "poster": "kronk",
      "data": "goodproof",
      "extra": [1,2,3]
    }, {
      "type": "useless"
    }, {
      "type": "useful",
      "poster": "eve",
      "data": "evil.com",
      "extra": [[4],5,6]
    }
  ]
}`
