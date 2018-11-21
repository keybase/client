#
# run:
#  iced megatest.iced > megatest.b64
#

{pack} = require 'purepack'

buf = (x) -> new Buffer ((i&0xff) for i in [0...x])
str = (x) -> (new Buffer ((i % 26) + 'a'.charCodeAt(0) for i in [0...x])).toString('utf8')
arr = (x) -> ((i & 0x3f) for i in [0...x])

map = (x) ->
  r = {}
  for i in [0...x]
    k = (new Buffer [(i % 26) + 'a'.charCodeAt(0)]).toString('utf8') + i
    v = i & 0x3f
    r[k] = v
  r



u8 = 0xa3
u16 = 0x103
u32 = 0x10003
u64 = 0x10000003

v =
  null_key : null
  false_key : false
  true_key : true
  bin8_key : buf(u8)
  bin16_key : buf(u16)
  bin32_key : buf(u32)
  double_key : 3.1415927e3
  uint8_key : u8
  uint16_key : u16
  uint32_key : u32
  uint64_key : u64
  int8_key : (0 - u8)
  int16_key : (0 - u16)
  int32_key : (0 - u32)
  int64_key : (0 - u64)
  str8 : str(u8)
  str16 : str(u16)
  str32 : str(u32)
  array16 : arr(u16)
  array32 : arr(u32)
  map16 : map(u16)
  map32 : map(u32)

for i in [0..0x1f]
  v['str'+i] = str(i)
for i in [0..0xf]
  v['arr'+i] = arr(i)
for i in [0..0xf]
  v['map'+i] = map(i)
for i in [0..0x7f]
  v['u'+i] = i
for i in [0..0x1f]
  v['i'+i] = (0 - i)

# console.log v
console.log (pack v).toString('base64')