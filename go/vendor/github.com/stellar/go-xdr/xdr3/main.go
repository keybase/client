package xdr

// Enum indicates this implementing type should be serialized/deserialized
// as an XDR Enum.  Implement ValidEnum to specify what values are valid for
// this enum.
type Enum interface {
	ValidEnum(int32) bool
}

// Sized types are types that have an explicit maximum size.  By default, the
// variable length XDR types (VarArray, VarOpaque and String) have a maximum
// byte size of a 2^32-1, but an implementor of this type may reduce that
// maximum to an appropriate value for the XDR schema in use.
type Sized interface {
	XDRMaxSize() int
}

// Union indicates the implementing type should be serialized/deserialized as
// an XDR Union.  The implementer must provide public fields, one for the
// union's disciminant, whose name must be returned by ArmForSwitch(), and
// one per potential value of the union, which must be a pointer.  For example:
//
//     type Result struct {
//       Type ResultType  // this is the union's disciminant, may be 0 to indicate success, 1 to indicate error
//       Msg  *string // this field will be populated when Type == 1
//     }
type Union interface {
	ArmForSwitch(int32) (string, bool)
	SwitchFieldName() string
}
