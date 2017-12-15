package goquery

import (
	"testing"
)

func BenchmarkFirst(b *testing.B) {
	b.StopTimer()
	sel := DocB().Find("dd")
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		sel.First()
	}
}

func BenchmarkLast(b *testing.B) {
	b.StopTimer()
	sel := DocB().Find("dd")
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		sel.Last()
	}
}

func BenchmarkEq(b *testing.B) {
	b.StopTimer()
	sel := DocB().Find("dd")
	j := 0
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		sel.Eq(j)
		if j++; j >= sel.Length() {
			j = 0
		}
	}
}

func BenchmarkSlice(b *testing.B) {
	b.StopTimer()
	sel := DocB().Find("dd")
	j := 0
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		sel.Slice(j, j+4)
		if j++; j >= (sel.Length() - 4) {
			j = 0
		}
	}
}

func BenchmarkGet(b *testing.B) {
	b.StopTimer()
	sel := DocB().Find("dd")
	j := 0
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		sel.Get(j)
		if j++; j >= sel.Length() {
			j = 0
		}
	}
}

func BenchmarkIndex(b *testing.B) {
	var j int

	b.StopTimer()
	sel := DocB().Find("#Main")
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		j = sel.Index()
	}
	if j != 3 {
		b.Fatalf("want 3, got %d", j)
	}
}

func BenchmarkIndexSelector(b *testing.B) {
	var j int

	b.StopTimer()
	sel := DocB().Find("#manual-nav dl dd:nth-child(1)")
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		j = sel.IndexSelector("dd")
	}
	if j != 4 {
		b.Fatalf("want 4, got %d", j)
	}
}

func BenchmarkIndexOfNode(b *testing.B) {
	var j int

	b.StopTimer()
	sel := DocB().Find("span a")
	sel2 := DocB().Find("span a:nth-child(3)")
	n := sel2.Get(0)
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		j = sel.IndexOfNode(n)
	}
	if j != 2 {
		b.Fatalf("want 2, got %d", j)
	}
}

func BenchmarkIndexOfSelection(b *testing.B) {
	var j int
	b.StopTimer()
	sel := DocB().Find("span a")
	sel2 := DocB().Find("span a:nth-child(3)")
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		j = sel.IndexOfSelection(sel2)
	}
	if j != 2 {
		b.Fatalf("want 2, got %d", j)
	}
}
