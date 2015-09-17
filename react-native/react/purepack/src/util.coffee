
##=======================================================================

exports.pow2 = pow2 = (n) -> if n < 31 then (1 << n) else Math.pow(2,n)
exports.U32MAX = U32MAX = pow2(32)
 
##=======================================================================

exports.rshift = (b, n) ->
  if n < 31 then (b >> n)
  else Math.floor(b / Math.pow(2,n))

##=======================================================================

exports.twos_compl = (x, n) -> if x < 0 then pow2(n) - Math.abs(x) else x
exports.twos_compl_inv = (x, n) -> x - pow2(n)
 
