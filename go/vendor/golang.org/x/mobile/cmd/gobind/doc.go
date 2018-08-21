// Copyright 2014 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Gobind generates language bindings that make it possible to call Go
functions from Java and Objective-C.

Typically gobind is not used directly. Instead, a binding is
generated and automatically packaged for Android or iOS by
`gomobile bind`. For more details on installing and using the gomobile
tool, see https://golang.org/x/mobile/cmd/gomobile.

Binding Go

Gobind generates target language (Java or Objective-C) bindings for
each exported symbol in a Go package. The Go package you choose to
bind defines a cross-language interface.

Bindings require additional Go code be generated, so using gobind
manually requires calling it twice, first with -lang=<target>, where
target is either java or objc, and again with -lang=go. The generated
package can then be _ imported into a Go program, typically built
with -buildmode=c-archive for iOS or -buildmode=c-shared for Android.
These details are handled by the `gomobile bind` command.

Passing Go objects to target languages

Consider a type for counting:

	package mypkg

	type Counter struct {
		Value int
	}

	func (c *Counter) Inc() { c.Value++ }

	func NewCounter() *Counter { return &Counter{ 5 } }

In Java, the generated bindings are,

	public abstract class Mypkg {
		public static native Counter newCounter();
	}

and

	public final class Counter {
		public Counter() { ... }

		public final long getValue();
		public final void setValue(long v);
		public void inc();

	}

The package-level function newCounter can be called like so:

	Counter c = Mypkg.newCounter()

For convenience, functions on the form NewT(...) *T are converted to constructors for T:

	Counter c = new Counter()

Both forms returns a Java Counter, which is a proxy for a Go *Counter. Calling the inc, getValue and
setValue methods will call the Go implementations of these methods.

Similarly, the same Go package will generate the Objective-C interface

	@class GoMypkgCounter;

	@interface GoMypkgCounter : NSObject {
	}

	@property(strong, readonly) id ref;
	- (void)inc;
	- (int64_t)value;
	- (void)setValue:(int64_t)v;
	@end

	FOUNDATION_EXPORT GoMypkgCounter* GoMypkgNewCounter(void);

The equivalent of calling newCounter in Go is GoMypkgNewCounter in Objective-C.
The returned GoMypkgCounter* holds a reference to an underlying Go
*Counter.

Passing target language objects to Go

For a Go interface:

	package myfmt

	type Printer interface {
		Print(s string)
	}

	func PrintHello(p Printer) {
		p.Print("Hello, World!")
	}

gobind generates a Java interface that can be used to implement a Printer:

	public abstract class Myfmt {
		public static void printHello(Printer p0);
	}

and

	public interface Printer {
		public void print(String s);
	}

You can implement Printer, and pass it to Go using the printHello
package function:

	public class SysPrint implements Printer {
		public void print(String s) {
			System.out.println(s);
		}
	}

The Java implementation can be used like so:

	Printer printer = new SysPrint();
	Myfmt.printHello(printer);


For Objective-C binding, gobind generates a protocol that declares
methods corresponding to Go interface's methods.

	@protocol GoMyfmtPrinter
	- (void)Print:(NSString*)s;
	@end

	FOUNDATION_EXPORT void GoMyfmtPrintHello(id<GoMyfmtPrinter> p0);

Any Objective-C classes conforming to the GoMyfmtPrinter protocol can be
passed to Go using the GoMyfmtPrintHello function:

	@interface SysPrint : NSObject<GoMyfmtPrinter> {
	}
	@end

	@implementation SysPrint {
	}
	- (void)Print:(NSString*)s {
		NSLog("%@", s);
	}
	@end

The Objective-C implementation can be used like so:

	SysPrint* printer = [[SysPrint alloc] init];
	GoMyfmtPrintHello(printer);


Type restrictions

At present, only a subset of Go types are supported.

All exported symbols in the package must have types that are supported.
Supported types include:

	- Signed integer and floating point types.

	- String and boolean types.

	- Byte slice types. Note that byte slices are passed by reference,
	  and support mutation.

	- Any function type all of whose parameters and results have
	  supported types. Functions must return either no results,
	  one result, or two results where the type of the second is
	  the built-in 'error' type.

	- Any interface type, all of whose exported methods have
	  supported function types.

	- Any struct type, all of whose exported methods have
	  supported function types and all of whose exported fields
	  have supported types.

Unexported symbols have no effect on the cross-language interface, and
as such are not restricted.

The set of supported types will eventually be expanded to cover more
Go types, but this is a work in progress.

Exceptions and panics are not yet supported. If either pass a language
boundary, the program will exit.


Reverse bindings

Gobind also supports accessing API from Java or Objective C from Go.
Similar to how Cgo supports the magic "C" import, gobind recognizes
import statements that start with "Java/" or "ObjC/". For example,
to import java.lang.System and call the static method currentTimeMillis:

	import "Java/java/lang/System"

	t := System.CurrentTimeMillis()

Similarly, to import NSDate and call the static method [NSDate date]:

	import "ObjC/Foundation/NSDate"

	d := NSDate.Date()

Gobind also supports specifying particular classes, interfaces or
protocols a particular Go struct should extend or implement. For example,
to create an Android Activity subclass MainActivity:

	import "Java/android/app/Activity"

	type MainActivity struct {
		app.Activity
	}

Gobind also recognizes Java interfaces as well as Objective C classes and
protocols the same way.

For more details on binding the the native API, see the design proposals,
https://golang.org/issues/16876 (Java) and https://golang.org/issues/17102
(Objective C).

Avoid reference cycles

The language bindings maintain a reference to each object that has been
proxied. When a proxy object becomes unreachable, its finalizer reports
this fact to the object's native side, so that the reference can be
removed, potentially allowing the object to be reclaimed by its native
garbage collector.  The mechanism is symmetric.

However, it is possible to create a reference cycle between Go and
objects in target languages, via proxies, meaning objects cannot be
collected. This causes a memory leak.

For example, in Java: if a Go object G holds a reference to the Go
proxy of a Java object J, and J holds a reference to the Java proxy
of G, then the language bindings on each side must keep G and J live
even if they are otherwise unreachable.

We recommend that implementations of foreign interfaces do not hold
references to proxies of objects. That is: if you implement a Go
interface in Java, do not store an instance of Seq.Object inside it.

Further reading

Examples can be found in http://golang.org/x/mobile/example.

Design doc: http://golang.org/s/gobind
*/
package main // import "golang.org/x/mobile/cmd/gobind"
