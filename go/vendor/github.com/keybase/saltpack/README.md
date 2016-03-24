# saltpack
### a modern crypto messaging format
https://saltpack.org/

**saltpack** is a streamlined, modern solution, designed with simplicity in mind. It is easy to implement & integrate. We've made few crypto decisions and instead leave almost all of the heavy lifting to the [NaCl library](https://godoc.org/golang.org/x/crypto/nacl).

**saltpack** is a binary message format, encoded using the [MessagePack](http://msgpack.org/) format. Messages are broken up into reasonable (1MB) chunks, over which regular [NaCl operations](https://nacl.cr.yp.to/) are performed. We have taken pains to address many of the [shortcomings](https://www.imperialviolet.org/2015/05/16/aeads.html) of current message formats: (1) only authenticated data is output; (2) repudiable authentication is used wherever possible; (3) chunks cannot be reordered or combined with other transmissions; (4) the public keys of senders and recipients can be hidden; and (5) message truncation is detectable.


Visually speaking, a **saltpack** ASCII output looks a lot like PGP's.
### saltpack
```
BEGIN SALTPACK SIGNED MESSAGE. kXR7VktZdyH7rvq v5wcIkHbs7XwHpb
nPtLcF6vE5yY63t aHF62jiEC1zHGqD inx5YqK0nf5W9Lp TvUmM2zBwxgd3Nw
kvzZ96W7ZfDdTVg F5Y99c2l5EsCy1I xVNl0nY1TP25vsX 2cRXXPUrM2UKtWq
UK2HG2ifBSOED4w xArcORHfFeiEZxF CqestMqLSCCE6lT HFcdvt1QX9JjmWL
o5AAqPiECnoHiSA bPHhz2JnSCyDIOz ZET1BWzttbMDL4N pcyQLmsGqYpxhG6
uvdBxdt55w9xQvQ hDPuOsKF05Hsml6 z7h9TS2msJcNwtz vxGIQR7sbB19UOt
boM1hlolmMB3loP 0KexlROFBTDC6MR nBvd9sZUxA8Z7i5 a6Dk5yFU3WEYQAo
DqqjXcp0yBoHO5O KEMqkZlyMf1PKiB 2n9wE6jwxAN1xws ccthT6X3iRYk0Br
gHW6QRXzAHLy6Ib LgY6b3UcQAoDo8b XyaExxinVuM5Ftk 75BJOWoyLGFhZS7
EfKR8jQQexvyjDM rJLxYtjvaLX7joS 2q1VcUlqGfZDhAa 4vxJQAyu57beOux
oobLhI47iZf9bxK PmYrVQ5PsC6pY1J KTQQexvlvp2yicx K4su2AFCjihbzNI
yZgKM4NHN1KZapS O3iB9SlhVfTfFcR FoQoSViTkbtDtTt 6I0jrTRHkv9XVQQ
eeeuzR7qYu1Grm3 zDPyj7JgK2mDidw HchOZnfOn59QLnM nH7ErnPRXgHuWHG
DBidjQPakJHuWsk 2ftpIyZd2NLYEFS Mqcbo6QeCdk7LA1 uobl4NXzpvi8amO
Pe8xAl1OzUCoD34 MbCwtTAe1JNymvs okufV8lHU0jVnbj u4no9QB9aP2Wkjx
PfeqIH2fEtOjmFP gPMhGWslkU0M7FL QP77gPHbgjPLSD8 yIRTrbgzpAPut5R
QhIdqVlHbUOa9sI v7gSqOi0GbUlhSM 183LxZI8pIlvgn9 Ms1WNzt5Xkv0W1Q
Qf419ZmuQVPQDOk 0hffDmUk71TlfVx XZCF3voC2ysgl3g YdLz4rDRzMJgd2m
01HIbfdsoZpAMty O27WtUNRLV1iyC9 tK5ApCyekI4nWcf 2OvTHnC8ma7bloW
XAG. END SALTPACK SIGNED MESSAGE.
```
### PGP
```
-----BEGIN PGP MESSAGE-----
Comment: GPGTools - https://gpgtools.org

owEBUAKv/ZANAwAKAdIkQTsc+mSQAcsgYgBWZ0C0SSBhbSBzbyBzaWNrIG9mIHRo
aXMgc2hpdAqJAhwEAAEKAAYFAlZnQLQACgkQ0iRBOxz6ZJBS9Q/+MSfWiOz5OvRt
lHTncX8Ifo7+wSKYH039vEQAUvj+rnEdlBzcJPoHDE1yZxAZT5ek5S+cxQ5bx55K
WRLvw/sAz+OU0OPHSDsqI2LjU6D+s1EvwCISkXoWlMVx5vJsEz2XGlQ8DzgBC2Jy
wPanQf1lUz0c7k0ySdCTdZ0qG1YuaYnCXsS6g/E8E7TIO++2v5EbkgYZl3Io2LcI
C9TqTHdrIc7WGTSFjwq9JIgvwfuShpccNSFQ262gSJh8rUOzzY37q81pKxDnBvEV
TMrQYY0e/JK7KMMcHDSQSeWnMxf4/v5Qex7WI55CW4++qbNvDylDi9fTpkYfXl3B
L8pbBAxMUjcJX4qVVzWcxTwSXYO29Bi4osn2klNyZHnO35kuI9XGziWCGqhVx1MW
ptNHoVjk7/Uo7k39hY0Vjltnl/SqXHq/H7YTRSgLebuhn6zqMbmFXtyHYSHGgAQ4
rcdSBta+I9tmYCnp1GmfeXff2wzsFYPUune2Hve4VghjmeU0x7OWMEl93gpznSwu
NvzyOCqFCyfEmt/R2QCXAkxwPU/Mdsd5vzEHSMkcZgW4CTr+j5YG/C3kMy7UJAGZ
ZzFAh3/Z8fCtfREF3zH48XbNh3dQXNl40bUF/AgPvLqPf35L7TCchcUAC7oiASa/
Ph/Hao4ZzCQDM76Jr/aCUJIbxyc2zco=
=eyef
-----END PGP MESSAGE-----
```
The changes here are small: we've reduced our characters to base62 plus some period markers, and only at the ends of words. PGP messages often get mangled by different apps, websites, and smart text processors.

Of course, **saltpack** can output binary, too. Either way, it's what's inside the format that matters. You can read the [spec](https://saltpack.org/encryption-format) for the details.
