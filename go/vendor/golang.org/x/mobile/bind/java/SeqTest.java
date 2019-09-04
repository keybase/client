// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package go;

import android.test.InstrumentationTestCase;
import android.test.MoreAsserts;

import java.util.Arrays;
import java.util.Random;

import testpkg.*;
import secondpkg.Secondpkg;

public class SeqTest extends InstrumentationTestCase {
  public SeqTest() {
  }

  public void testConst() {
    assertEquals("const String", "a string", Testpkg.AString);
    assertEquals("const Int", 7, Testpkg.AnInt);
    assertEquals("const Bool", true, Testpkg.ABool);
    assertEquals("const Float", 0.12345, Testpkg.AFloat, 0.0001);

    assertEquals("const MinInt32", -1<<31, Testpkg.MinInt32);
    assertEquals("const MaxInt32", (1<<31) - 1, Testpkg.MaxInt32);
    assertEquals("const MinInt64", -1L<<63, Testpkg.MinInt64);
    assertEquals("const MaxInt64", (1L<<63) - 1, Testpkg.MaxInt64);
    assertEquals("const SmallestNonzeroFloat64", 4.940656458412465441765687928682213723651e-324, Testpkg.SmallestNonzeroFloat64, 1e-323);
    assertEquals("const MaxFloat64", 1.797693134862315708145274237317043567981e+308, Testpkg.MaxFloat64, 0.0001);
    assertEquals("const SmallestNonzeroFloat32", 1.401298464324817070923729583289916131280e-45, Testpkg.SmallestNonzeroFloat32, 1e-44);
    assertEquals("const MaxFloat32", 3.40282346638528859811704183484516925440e+38, Testpkg.MaxFloat32, 0.0001);
    assertEquals("const Log2E", 1/0.693147180559945309417232121458176568075500134360255254120680009, Testpkg.Log2E, 0.0001);
  }

  public void testRefMap() {
    // Ensure that the RefMap.live count is kept in sync
    // even a particular reference number is removed and
    // added again
    Seq.RefMap m = new Seq.RefMap();
    Seq.Ref r = new Seq.Ref(1, null);
    m.put(r.refnum, r);
    m.remove(r.refnum);
    m.put(r.refnum, r);
    // Force the RefMap to grow, to activate the sanity
    // checking of the live count in RefMap.grow.
    for (int i = 2; i < 24; i++) {
      m.put(i, new Seq.Ref(i, null));
    }
  }

  public void testVar() {
    assertEquals("var StringVar", "a string var", Testpkg.getStringVar());

    String newStringVar = "a new string var";
    Testpkg.setStringVar(newStringVar);
    assertEquals("var StringVar", newStringVar, Testpkg.getStringVar());

    assertEquals("var IntVar", 77, Testpkg.getIntVar());

    long newIntVar = 777;
    Testpkg.setIntVar(newIntVar);
    assertEquals("var IntVar", newIntVar, Testpkg.getIntVar());

    S s0 = Testpkg.getStructVar();
    assertEquals("var StructVar", "a struct var", s0.string());
    S s1 = Testpkg.new_();
    Testpkg.setStructVar(s1);
    assertEquals("var StructVar", s1.string(), Testpkg.getStructVar().string());

    AnI obj = new AnI();
    obj.name = "this is an I";
    Testpkg.setInterfaceVar(obj);
    assertEquals("var InterfaceVar", obj.string(), Testpkg.getInterfaceVar().string());
  }

  public void testAssets() {
    // Make sure that a valid context is set before reading assets
    Seq.setContext(getInstrumentation().getContext());
    String want = "Hello, Assets.\n";
    String got = Testpkg.readAsset();
    assertEquals("Asset read", want, got);
  }

  public void testAdd() {
    long res = Testpkg.add(3, 4);
    assertEquals("Unexpected arithmetic failure", 7, res);
  }

  public void testBool() {
    assertTrue(Testpkg.negate(false));
    assertFalse(Testpkg.negate(true));
  }

  public void testShortString() {
    String want = "a short string";
    String got = Testpkg.strDup(want);
    assertEquals("Strings should match", want, got);

    want = "";
    got = Testpkg.strDup(want);
    assertEquals("Strings should match (empty string)", want, got);

    got = Testpkg.strDup(null);
    assertEquals("Strings should match (null string)", want, got);
  }

  public void testLongString() {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < 128*1024; i++) {
      b.append("0123456789");
    }
    String want = b.toString();
    String got = Testpkg.strDup(want);
    assertEquals("Strings should match", want, got);
  }

  public void testUnicode() {
    String[] tests = new String[]{
      "abcxyz09{}",
      "Hello, 世界",
      "\uffff\uD800\uDC00\uD800\uDC01\uD808\uDF45\uDBFF\uDFFF",
      // From Go std lib tests in unicode/utf16/utf16_test.go
      "\u0001\u0002\u0003\u0004",
      "\uffff\ud800\udc00\ud800\udc01\ud808\udf45\udbff\udfff",
      "\ud800a",
      "\udfff"
    };
    String[] wants = new String[]{
      "abcxyz09{}",
      "Hello, 世界",
      "\uffff\uD800\uDC00\uD800\uDC01\uD808\uDF45\uDBFF\uDFFF",
      "\u0001\u0002\u0003\u0004",
      "\uffff\ud800\udc00\ud800\udc01\ud808\udf45\udbff\udfff",
      "\ufffda",
      "\ufffd"
    };
    for (int i = 0; i < tests.length; i++) {
      String got = Testpkg.strDup(tests[i]);
      String want = wants[i];
      assertEquals("Strings should match", want, got);
    }
  }

  public void testNilErr() throws Exception {
    Testpkg.err(null); // returns nil, no exception
  }

  public void testErr() {
    String msg = "Go errors are dropped into the confusing space of exceptions";
    try {
      Testpkg.err(msg);
      fail("expected non-nil error to be turned into an exception");
    } catch (Exception e) {
      assertEquals("messages should match", msg, e.getMessage());
    }
  }

  public void testByteArray() {
    for (int i = 0; i < 2048; i++) {
      if (i == 0) {
        byte[] got = Testpkg.bytesAppend(null, null);
        assertEquals("Bytes(null+null) should match", (byte[])null, got);
        got = Testpkg.bytesAppend(new byte[0], new byte[0]);
        assertEquals("Bytes(empty+empty) should match", (byte[])null, got);
        continue;
      }

      byte[] want = new byte[i];
      new Random().nextBytes(want);

      byte[] s1 = null;
      byte[] s2 = null;
      if (i > 0) {
        s1 = Arrays.copyOfRange(want, 0, 1);
      }
      if (i > 1) {
        s2 = Arrays.copyOfRange(want, 1, i);
      }
      byte[] got = Testpkg.bytesAppend(s1, s2);
      MoreAsserts.assertEquals("Bytes(len="+i+") should match", want, got);
    }
  }

  // Test for golang.org/issue/9486.
  public void testByteArrayAfterString() {
    byte[] bytes = new byte[1024];
    for (int i=0; i < bytes.length; i++) {
           bytes[i] = 8;
    }

    String stuff = "stuff";
    byte[] got = Testpkg.appendToString(stuff, bytes);

    try {
      byte[] s = stuff.getBytes("UTF-8");
      byte[] want = new byte[s.length + bytes.length];
      System.arraycopy(s, 0, want, 0, s.length);
      System.arraycopy(bytes, 0, want, s.length, bytes.length);
      MoreAsserts.assertEquals("Bytes should match", want, got);
    } catch (Exception e) {
      fail("Cannot perform the test: " + e.toString());
    }
  }

  public void testGoRefGC() {
    S s = Testpkg.new_();
    runGC();
    long collected = Testpkg.numSCollected();
    assertEquals("Only S should be pinned", 0, collected);

    s = null;
    runGC();
    collected = Testpkg.numSCollected();
    assertEquals("S should be collected", 1, collected);
  }

  private class AnI implements I {
    public void e() throws Exception {
      throw new Exception("my exception from E");
    }

    boolean calledF;
    public void f() {
      calledF = true;
    }

    public I i() {
      return this;
    }

    public S s() {
      return Testpkg.new_();
    }

    public String stoString(S s) {
      return s.string();
    }

    public long v() {
      return 1234;
    }

    public long ve() throws Exception {
      throw new Exception("my exception from VE");
    }

    public String name;

    public String string() {
      return name;
    }

  }

  // TODO(hyangah): add tests for methods that take parameters.

  public void testInterfaceMethodReturnsError() {
    final AnI obj = new AnI();
    try {
      Testpkg.callE(obj);
      fail("Expecting exception but none was thrown.");
    } catch (Exception e) {
      assertEquals("Error messages should match", "my exception from E", e.getMessage());
    }
  }

  public void testInterfaceMethodVoid() {
    final AnI obj = new AnI();
    Testpkg.callF(obj);
    assertTrue("Want AnI.F to be called", obj.calledF);
  }

  public void testInterfaceMethodReturnsInterface() {
    AnI obj = new AnI();
    obj.name = "testing AnI.I";
    I i = Testpkg.callI(obj);
    assertEquals("Want AnI.I to return itself", i.string(), obj.string());

    runGC();

    i = Testpkg.callI(obj);
    assertEquals("Want AnI.I to return itself", i.string(), obj.string());
  }

  public void testInterfaceMethodReturnsStructPointer() {
    final AnI obj = new AnI();
    for (int i = 0; i < 5; i++) {
      S s = Testpkg.callS(obj);
      runGC();
    }
  }

  public void testInterfaceMethodTakesStructPointer() {
    final AnI obj = new AnI();
    S s = Testpkg.callS(obj);
    String got = obj.stoString(s);
    String want = s.string();
    assertEquals("Want AnI.StoString(s) to call s's String", want, got);
  }

  public void testInterfaceMethodReturnsInt() {
    final AnI obj = new AnI();
    assertEquals("Values must match", 1234, Testpkg.callV(obj));
  }

  public void testInterfaceMethodReturnsIntOrError() {
    final AnI obj = new AnI();
    try {
      long v = Testpkg.callVE(obj);
      fail("Expecting exception but none was thrown and got value " + v);
    } catch (Exception e) {
      assertEquals("Error messages should match", "my exception from VE", e.getMessage());
    }
  }

  boolean finalizedAnI;

  private class AnI_Traced extends AnI {
    @Override
    public void finalize() throws Throwable {
      finalizedAnI = true;
      super.finalize();
    }
  }

  public void testJavaRefKeep() {
    finalizedAnI = false;
    AnI obj = new AnI_Traced();
    Testpkg.callF(obj);
    assertTrue("want F to be called", obj.calledF);
    Testpkg.callF(obj);
    obj = null;
    int attempts = 0;
    while (true) {
        runGC();
        if (finalizedAnI)
            break;
        attempts++;
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        if (attempts >= 10)
            fail("want obj not to be kept by Go; tried " + attempts + " garbage collections.");
    }

    finalizedAnI = false;
    obj = new AnI_Traced();
    Testpkg.keep(obj);
    obj = null;
    runGC();
    assertFalse("want obj to be kept live by Go", finalizedAnI);
  }

  private int countI = 0;

  private class CountI implements I {
    public void f() { countI++; }

    public void e() throws Exception {}
    public I i() { return null; }
    public S s() { return null; }
    public String stoString(S s) { return ""; }
    public long v() { return 0; }
    public long ve() throws Exception { return 0; }
    public String string() { return ""; }
  }

  public void testGoRefMapGrow() {
    CountI obj = new CountI();
    Testpkg.keep(obj);

    // Push active references beyond base map size.
    for (int i = 0; i < 24; i++) {
      CountI o = new CountI();
      Testpkg.callF(o);
      if (i%3==0) {
        Testpkg.keep(o);
      }
    }
    runGC();
    for (int i = 0; i < 128; i++) {
      Testpkg.callF(new CountI());
    }

    Testpkg.callF(obj); // original object needs to work.

    assertEquals(countI, 1+24+128);
  }

  private void runGC() {
    System.gc();
    System.runFinalization();
    Testpkg.gc();
    System.gc();
    System.runFinalization();
  }

  public void testUnnamedParams() {
    final String msg = "1234567";
    assertEquals("want the length of \"1234567\" passed after unnamed params",
		    7, Testpkg.unnamedParams(10, 20, msg));
  }

  public void testPointerToStructAsField() {
    Node a = Testpkg.newNode("A");
    Node b = Testpkg.newNode("B");
    a.setNext(b);
    String got = a.string();
    assertEquals("want Node A points to Node B", "A:B:<end>", got);
  }

  public void testImplementsInterface() {
    Interface intf = Testpkg.newConcrete();
  }

  public void testErrorField() {
    Node n = Testpkg.newNode("ErrTest");
    Exception want = new Exception("an error message");
    n.setErr(want);
    Exception got = n.getErr();
    assertTrue("want back the error we set", want == got);
    String msg = Testpkg.errorMessage(want);
    assertEquals("the error message must match", want.getMessage(), msg);
  }

  public void testErrorDup() {
    Exception err = Testpkg.getGlobalErr();
    assertTrue("the Go error instance must preserve its identity", Testpkg.isGlobalErr(err));
    assertEquals("the Go error message must be preserved", "global err", err.getMessage());
  }

  //test if we have JNI local reference table overflow error
  public void testLocalReferenceOverflow() {
    Testpkg.callWithCallback(new GoCallback() {

      @Override
      public void varUpdate() {
        //do nothing
      }
    });
  }

  public void testNullReferences() {
    assertTrue(Testpkg.callWithNull(null, new NullTest() {
      public NullTest null_() {
        return null;
      }
    }));
    assertEquals("Go nil interface is null", null, Testpkg.newNullInterface());
    assertEquals("Go nil struct pointer is null", null, Testpkg.newNullStruct());

    Issue20330 nullArger = new Issue20330();
    assertTrue(nullArger.callWithNull(null));
  }

  public void testPassByteArray() {
    Testpkg.passByteArray(new B() {
      @Override public void b(byte[] b) {
        byte[] want = new byte[]{1, 2, 3, 4};
        MoreAsserts.assertEquals("bytes should match", want, b);
      }
    });
  }

  public void testReader() {
    byte[] b = new byte[8];
    try {
      long n = Testpkg.readIntoByteArray(b);
      assertEquals("wrote to the entire byte array", b.length, n);
      byte[] want = new byte[b.length];
      for (int i = 0; i < want.length; i++)
        want[i] = (byte)i;
      MoreAsserts.assertEquals("bytes should match", want, b);
     } catch (Exception e) {
       fail("Failed to write: " + e.toString());
     }
  }

  public void testGoroutineCallback() {
    Testpkg.goroutineCallback(new Receiver() {
      @Override public void hello(String msg) {
      }
    });
  }

  public void testImportedPkg() {
    Testpkg.callImportedI(new secondpkg.I() {
      @Override public long f(long i) {
        return i;
      }
    });
    assertEquals("imported string should match", Secondpkg.HelloString, Secondpkg.hello());
    secondpkg.I i = Testpkg.newImportedI();
    secondpkg.S s = Testpkg.newImportedS();
    i = Testpkg.getImportedVarI();
    s = Testpkg.getImportedVarS();
    assertEquals("numbers should match", 8, i.f(8));
    assertEquals("numbers should match", 8, s.f(8));
    Testpkg.setImportedVarI(i);
    Testpkg.setImportedVarS(s);
    ImportedFields fields = Testpkg.newImportedFields();
    i = fields.getI();
    s = fields.getS();
    fields.setI(i);
    fields.setS(s);
    Testpkg.withImportedI(i);
    Testpkg.withImportedS(s);

    secondpkg.IF f = new AnI();
    f = Testpkg.new_();
    secondpkg.Ser ser = Testpkg.newSer();
  }

  public void testRoundtripEquality() {
    I want = new AnI();
    assertTrue("java object passed through Go should not be wrapped", want == Testpkg.iDup(want));
    InterfaceDupper idup = new InterfaceDupper(){
      @Override public Interface iDup(Interface i) {
        return i;
      }
    };
    assertTrue("Go interface passed through Java should not be wrapped", Testpkg.callIDupper(idup));
    ConcreteDupper cdup = new ConcreteDupper(){
      @Override public Concrete cDup(Concrete c) {
        return c;
      }
    };
    assertTrue("Go struct passed through Java should not be wrapped", Testpkg.callCDupper(cdup));
  }

  public void testConstructor() {
    Interface i = new Concrete();
    i.f();

    S2 s = new S2(1, 2);
    assertEquals("new S2().sum", 3.0, s.sum());
    assertEquals("new S2().tryTwoStrings", "gostring", s.tryTwoStrings("go", "string"));

	  new S3();

	  S4 s4 = new S4(123);
	  assertEquals("Constructor argument", 123, s4.getI());

    s4 = new S4(123.456);
    assertEquals("Overloaded constructor argument", 123, s4.getI());

    s4 = new S4(false);
    assertEquals("Exceptional constructor", 0, s4.getI());

    try {
      s4 = new S4(true);
      fail("Constructor error wasn't caught");
    } catch (Exception e) {
    }
  }

  public void testEmptyError() {
    try {
      Testpkg.emptyError();
      fail("Empty error wasn't caught");
    } catch (Exception e) {
    }
    EmptyErrorer empty = new EmptyErrorer() {
      @Override public void emptyError() throws Exception {
        throw new Exception("");
      }
    };
    try {
      Testpkg.callEmptyError(empty);
      fail("Empty exception wasn't caught");
    } catch (Exception e) {
    }
  }

  public void testInitCaller() {
    Testpkg.init();

    InitCaller initer = Testpkg.newInitCaller();
    initer.init();
  }

  public void testSIGPIPE() {
    Testpkg.testSIGPIPE();
  }

  public void testTags() {
    assertEquals("Constant from a tagged file", 42, Testpkg.TaggedConst);
  }

  public void testClassNameWithPackageName() {
    testpkg.Testpkg_ o = new secondpkg.Secondpkg_();
    secondpkg.Secondpkg_ o2 = Secondpkg.newSecondpkg();
    o2.m();
    o2.setV("hi");
    assertEquals(o2.getV(), "hi");
    Testpkg.clashingParameterFromOtherPackage(o2);
  }
}
