
# AVDL Variants

We now have supports for
[*variant*s](https://en.wikipedia.org/wiki/Disjoint_union) (AKA *discriminated
unions* AKA *tagged unions* AKA *disjoint unions*) in AVDL.

This data structure is useful if you want one of several options for what a
record is.  We already fake this via records with pointers, some of which are
specified, and some of which are `null`, but this feature makes that pattern
explicit and type-safe-r.

## Example

Consider this AVDL input example. We're declaring a new data type
called `Foo` which can act as an `int`, or a `Zap`, depending
on what the `FooType` selector says:

```
enum FooType {
	BOO_0,
	ZAP_1
}

record Zap {
	int a;
	int b;
}

variant Foo switch (FooType fooType) {
	case BOO: int;
	case ZAP: Zap;
}
```

## Interface


The key idea is that we have a new
`struct` called `Foo`, which maintains the invariant that `Foo` takes the shape of an `int` when `fooType == BOO`, and take the shape of a `Zap` when `fooType == ZAP`. These
structures are also immutable and can't be change once they've been constructed:

```go
b := NewFooWithBoo(1)
z := NewFooWithZap(Zap{A: 2, B: 3})
```

Now we have accessors that are best combined with Go `switch`es:

```go
t, err := b.FooType() // will return t == BOO, err == nil
switch t {
	case FooType_BOO:
		fmt.Printf("%+v\n", b.Boo())
	case FooType_ZAP:
		fmt.Printf("%+v\n", b.Zap())
}
```

That's really all there is to it.  Note that `FooType()` can return an error.
You'll only see this if an adversary tries to send you a malformed msgpack
structure that advertises a type but has `nil`s set where the data should
be.

## Output Code

Here's the RAW output Go code of the above:

```go

type FooType int
const (
	FooType_BOO FooType = 0
	FooType_ZAP FooType = 1
)

var FooTypeMap = map[string]FooType{
	"BOO" : 0,
	"ZAP" : 1,
}

type Zap struct {
	A	int	`codec:"a" json:"a"`
	B	int	`codec:"b" json:"b"`
}

type Foo struct {
	FooType__	FooType	`codec:"fooType" json:"fooType"`
	Boo__	*int	`codec:"boo,omitempty" json:"boo,omitempty"`
	Zap__	*Zap	`codec:"zap,omitempty" json:"zap,omitempty"`
}

func (o *Foo) FooType() (ret FooType, err error) {
	switch (o.FooType__) {
		case FooType_BOO:
			if o.Boo__ == nil {
				err = errors.New("unexpected nil value for Boo__")
				return ret, err
			}
		case FooType_ZAP:
			if o.Zap__ == nil {
				err = errors.New("unexpected nil value for Zap__")
				return ret, err
			}
	}
	return o.FooType__, nil
}

func (o Foo) Boo() int {
	if o.FooType__ != FooType_BOO {
		panic("wrong case accessed")
	}
	if o.Boo__ == nil {
		return 0
	}
	return *o.Boo__
}

func (o Foo) Zap() Zap {
	if o.FooType__ != FooType_ZAP {
		panic("wrong case accessed")
	}
	if o.Zap__ == nil {
		return Zap{}
	}
	return *o.Zap__
}

func NewFooWithBoo(v int) Foo {
	return Foo{
		FooType__ : FooType_BOO,
		Boo__ : &v,
	}
}

func NewFooWithZap(v Zap) Foo {
	return Foo{
		FooType__ : FooType_ZAP,
		Zap__ : &v,
	}
}
```
