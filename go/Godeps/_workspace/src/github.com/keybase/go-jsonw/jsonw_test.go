package jsonw

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestInt(t *testing.T) {
	const x = 100
	w := NewInt(x)
	if v, _ := w.GetInt(); v != x {
		t.Errorf("%d != %d in GetInt() test", v, x)
	}
}

func TestBigInt(t *testing.T) {
	const x = 1<<62 + 55555
	w := NewInt64(x)
	if v, _ := w.GetInt64(); v != x {
		t.Errorf("Big int test failed")
	}
	if v, _ := w.GetUint64(); v != x {
		t.Errorf("Big uint test failed")
	}
}

func TestFloat(t *testing.T) {
	e := 2.71828183
	f := NewFloat64(e)
	e2, err := f.GetFloat()

	if err != nil {
		t.Errorf("Getting a float failed: %s\n", err)
	} else if (e-e2)*(e-e2) > .1 {
		t.Errorf("Weird mismatch: %f v %f\n", e, e2)
	}

	jsonStream := []byte("{ \"e\" : 2.71828183 }")
	var res interface{}
	err = json.Unmarshal(jsonStream, &res)
	if err != nil {
		t.Errorf("cannot unmarshall: %s\n", err)
	}
	w := NewWrapper(res)

	e2, err = w.AtKey("e").GetFloat()
	if err != nil {
		t.Errorf("Pass 2: Getting a float failed: %s\n", err)
	} else if (e-e2)*(e-e2) > .1 {
		t.Errorf("Pass 2: Weird mismatch: %f v %f\n", e, e2)
	}

}

func TestBytes(t *testing.T) {
	s := "hello world"
	buf := bytes.NewBufferString(s)
	bv := buf.Bytes()

	w := NewWrapper(bv)
	if out, err := w.GetString(); err != nil || out != s {
		t.Errorf("failed to get %s back out", s)
	}

}

func TestVoid(t *testing.T) {
	w := NewDictionary()

	/*
			 * { "uno" : "un",
			 *   "dos" : "deux",
			 *   "tres" : "trois",
			 *   "quatro" : 4,
			 *   "others" : [ 100, 101, 102 ]
		         *  }
	*/
	w.SetKey("uno", NewString("un"))
	w.SetKey("dos", NewString("deux"))
	w.SetKey("tres", NewString("trois"))
	w.SetKey("quatro", NewInt(4))
	w.SetKey("others", NewArray(3))
	w.AtKey("others").SetIndex(0, NewInt(100))
	w.AtKey("others").SetIndex(1, NewInt(101))
	w.AtKey("others").SetIndex(2, NewInt(102))

	var e, e2 error
	var s string
	var i int

	w.AtKey("dos").GetStringVoid(&s, &e)
	if e != nil || s != "deux" {
		t.Errorf("Failure for dos/deux")
	}
	w.AtKey("tres").GetIntVoid(&i, &e)
	if e == nil {
		t.Errorf("Expected an error on tres!")
	}
	expected := "<root>.tres: type error: wanted int, got string"
	if e.Error() != expected {
		t.Errorf("Wanted error '%s', but got '%s'", expected, e.Error())
	}
	w.AtKey("quatro").GetStringVoid(&s, &e)
	if e.Error() != expected {
		t.Errorf("Wanted error '%s' to stick around, but got '%s'",
			expected, e.Error())
	}
	w.AtKey("others").AtIndex(2).GetStringVoid(&s, &e2)
	expected = "<root>.others[2]: type error: wanted string, got int"
	if e2 == nil || e2.Error() != expected {
		t.Errorf("others[2]: Wanted error '%s', got '%s'",
			expected, e2)
	}

}

func TestDict(t *testing.T) {
	w := NewDictionary()
	const dog = 3333
	var cat string = "meow"

	w.SetKey("dog", NewInt(dog))
	w.SetKey("cat", NewString(cat))

	if v, _ := w.AtKey("dog").GetInt(); v != dog {
		t.Errorf("Dictionary fail for 'dog': %d != %d", v, dog)
	}

	if v, _ := w.AtKey("cat").GetString(); v != cat {
		t.Errorf("Dictionary fail for 'dog': %s != %s", v, cat)
	}

	const parrot = 3318
	var sparrow string = "tweet"

	w.SetKey("birds", NewDictionary())
	w.AtKey("birds").SetKey("parrot", NewInt(parrot))
	w.AtKey("birds").SetKey("sparrow", NewString(sparrow))

	if v, _ := w.AtKey("birds").AtKey("sparrow").GetString(); v != sparrow {
		t.Errorf("Dictionary fail for birds.sparrow: %s != %s", v, sparrow)
	}
	if v, _ := w.AtKey("birds").AtKey("parrot").GetInt(); v != parrot {
		t.Errorf("Dictionary fail for birds.sparrow: %d != %d", v, parrot)
	}

	w.AtKey("birds").SetKey("waterfowl", NewArray(2))
	w.AtKey("birds").AtKey("waterfowl").SetIndex(0, NewString("duck"))
	w.AtKey("birds").AtKey("waterfowl").SetIndex(1, NewString("swan"))

	if v, _ := w.AtKey("birds").AtKey("waterfowl").Len(); v != 2 {
		t.Errorf("Wrong length for birds.waterfowl: %d v %d", v, 2)
	}

	if v, _ := w.AtKey("birds").AtKey("waterfowl").AtIndex(1).GetString(); v != "swan" {
		t.Errorf("Wrong waterfowl in array: %s v swan (%s)", v)
	}
}

func TestPath(t *testing.T) {
	w := NewDictionary()
	w.SetKey("dogs", NewArray(2))
	w.AtKey("dogs").SetIndex(0, NewDictionary())
	w.AtKey("dogs").SetIndex(1, NewDictionary())

	w.AtKey("dogs").AtIndex(0).SetKey("age", NewInt(7))
	w.SetValueAtPath("dogs.0.name.first", NewString("Fido"))

	w.AtKey("dogs").AtIndex(1).SetKey("age", NewInt(3))
	w.AtKey("dogs").AtIndex(1).SetKey("name", NewDictionary())
	w.AtKey("dogs").AtIndex(1).AtKey("name").SetKey("first", NewString("Peanut"))

	w.SetValueAtPath("cats.1.name", NewString("Tommy"))

	if v, e := w.AtPath("dogs.0.age").GetInt(); e != nil {
		t.Errorf("Expected 7 for dogs.0.age, got Error: %v", e)
	} else if int(v) != 7 {
		t.Errorf("Expected 7 for dogs.0.age, got: %v", v)
	}

	if v, e := w.AtPath("dogs.1.name.first").GetString(); e != nil {
		t.Errorf("Expected Peanut for dogs.1.name.first, got Error: %v", e)
	} else if v != "Peanut" {
		t.Errorf("Expected Peanut for dogs.1.name.first, got: %v", v)
	}

	if v, e := w.AtPath("cats").ToArray(); e != nil {
		t.Errorf("Expected Tommy for cats.1.name, got Error: %v", e)
	} else if v2, e2 := v.AtIndex(1).ToDictionary(); e2 != nil {
		t.Errorf("Expected Tommy for cats.1.name, got Error: %v", e2)
	} else if v3, e3 := v2.AtKey("name").GetString(); e3 != nil {
		t.Errorf("Expected Tommy for cats.1.name, got Error: %v", e3)
	} else if v3 != "Tommy" {
		t.Errorf("Expected Tommy for cats.1.name, got: %v", v2)
	}

	if v, ok := w.AtPathGetInt("dogs.1.age"); !ok {
		t.Errorf("Not ok; failed to find at int at dogs.1.age")
	} else if v != 3 {
		t.Errorf("Got wrong age at dogs.1.age (%d)", v)
	}

	// Now try deleting
	w.DeleteValueAtPath("cats.1.name")
	if v, e := w.AtPath("cats").ToArray(); e != nil {
		t.Errorf("Expected cats for cats.1.name, got Error: %v", e)
	} else if v2, e2 := v.AtIndex(1).ToDictionary(); e2 != nil {
		t.Errorf("Expected 1 for cats.1.name, got Error: %v", e2)
	} else if v3, e3 := v2.AtKey("name").GetString(); e3 == nil {
		t.Errorf("Expected nothing after deletion of cats.1.name, got: %s", v3)
	}

	// now delete an array member
	w.SetValueAtPath("cats.0.name", NewString("Linus"))
	w.DeleteValueAtPath("cats.1")
	if v, e := w.AtPath("cats").ToArray(); e != nil {
		t.Errorf("Expected cats for cats.1, got Error: %v", e)
	} else if v2 := v.AtIndex(1); !v2.IsNil() {
		t.Errorf("Expected nil for cats.1, got: %v", v2)
	} else if _, e3 := v.AtIndex(0).ToDictionary(); e3 != nil {
		t.Errorf("Expected a value for cats.0, got Error: %v", e3)
	}

	// try overwriting a path with a longer path
	err := w.SetValueAtPath("dogs.0.name.first.initial", NewString("F"))
	if err != nil {
		t.Errorf("Expected to set dogs.0.name.first.initial, "+
			"got Error: %v", err)
	} else if v, e := w.AtPath("dogs.0.name.first").ToDictionary(); e != nil {
		t.Errorf("Expected dictionary for dogs.1.name.first, got Error: %v", e)
	} else if v2, e2 := v.AtKey("initial").GetString(); e2 != nil {
		t.Errorf("Expected F for dogs.0.name.first.initial, got Error: %v", e2)
	} else if v2 != "F" {
		t.Errorf("Expected F for dogs.0.name.first.initial, got: %v", v2)
	}

	// try overwriting a path with a shorter path
	err = w.SetValueAtPath("dogs.0.name", NewString("Fido Barkley"))
	if err != nil {
		t.Errorf("Expected to set dogs.0.name, got Error: %v", err)
	} else if v, e := w.AtPath("dogs.0.name").GetString(); e != nil {
		t.Errorf("Expected Fido Barkley for dogs.0.name, got Error: %v", e)
	} else if v != "Fido Barkley" {
		t.Errorf("Expected Fido Barkley for dogs.0.name.first.initial, got: %v",
			v)
	}
}
