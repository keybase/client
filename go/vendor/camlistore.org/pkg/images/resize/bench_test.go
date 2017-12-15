/*
Copyright 2013 The Camlistore Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package resize

import (
	"image"
	"testing"
)

func resize(m image.Image) {
	s := m.Bounds().Size().Div(2)
	Resize(m, m.Bounds(), s.X, s.Y)
}

func halve(m image.Image) {
	HalveInplace(m)
}

func BenchmarkResizeRGBA(b *testing.B) {
	m := image.NewRGBA(orig)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resize(m)
	}
}

func BenchmarkHalveRGBA(b *testing.B) {
	m := image.NewRGBA(orig)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		halve(m)
	}
}

func BenchmarkResizeYCrCb(b *testing.B) {
	m := image.NewYCbCr(orig, image.YCbCrSubsampleRatio422)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resize(m)
	}
}

func BenchmarkHalveYCrCb(b *testing.B) {
	m := image.NewYCbCr(orig, image.YCbCrSubsampleRatio422)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		halve(m)
	}
}
