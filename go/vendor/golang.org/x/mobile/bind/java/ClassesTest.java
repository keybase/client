// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package go;

import android.test.InstrumentationTestCase;
import android.test.MoreAsserts;

import java.io.InputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Random;

import javapkg.Javapkg;
import javapkg.I;
import javapkg.GoObject;
import javapkg.GoRunnable;
import javapkg.GoSubset;
import javapkg.GoInputStream;
import javapkg.GoArrayList;

public class ClassesTest extends InstrumentationTestCase {
	public void testConst() {
		assertEquals("const Float", Float.MIN_VALUE, Javapkg.floatMin());
		assertEquals("const String", java.util.jar.JarFile.MANIFEST_NAME, Javapkg.manifestName());
		assertEquals("const Int", 7, Integer.SIZE, Javapkg.integerBytes());
	}

	public void testFunction() {
		Javapkg.systemCurrentTimeMillis();
	}

	public void testMethod() {
		try {
			assertEquals("Integer.decode", 0xff, Javapkg.integerDecode("0xff"));
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
		Exception exc = null;
		try {
			Javapkg.integerDecode("obviously wrong");
		} catch (Exception e) {
			exc = e;
		}
		assertNotNull("IntegerDecode Exception", exc);
	}

	public void testOverloadedMethod() {
		try {
			assertEquals("Integer.parseInt", 0xc4, Javapkg.integerParseInt("c4", 16));
		} catch (Exception e) {
			throw new RuntimeException(e);
		}
		Exception exc = null;
		try {
			Javapkg.integerParseInt("wrong", 16);
		} catch (Exception e) {
			exc = e;
		}
		assertNotNull("integerParseInt Exception", exc);
		assertEquals("Integer.valueOf", 42, Javapkg.integerValueOf(42));
	}

	public void testException() {
		Exception exc = null;
		try {
			Javapkg.provokeRuntimeException();
		} catch (Exception e) {
			exc = e;
		}
		assertNotNull("RuntimeException", exc);
	}

	public void testField() {
		GoRunnable r = new GoRunnable();
		String f = r.getField();
	}

	public void testGoObject() {
		Runnable r = new GoRunnable();
		r.run();
		assertEquals("GoRunnable.toString", r.toString(), Javapkg.ToStringPrefix);
		Runnable r2 = ((GoRunnable)r).getThis();
		assertTrue("GoObject.this", r == r2);
		Object o = new GoObject();
		assertEquals("GoObject hashCode", 42, o.hashCode());
		Object o2 = Javapkg.constructGoObject();
		assertEquals("GoObject hashCode", 42, o2.hashCode());
		assertTrue("GoObject.toString", o.toString().startsWith(Javapkg.ToStringPrefix));
		Javapkg.runRunnable(r);
		final boolean[] ran = new boolean[1];
		Runnable r3 = new Runnable(){
			@Override public void run() {
				ran[0] = true;
			}
		};
		Javapkg.runRunnable(r3);
		assertTrue("RunRunnable", ran[0]);
		assertTrue("RunnableRoundtrip Java", r3 == Javapkg.runnableRoundtrip(r3));
		assertTrue("RunnableRoundtrip Go", r == Javapkg.runnableRoundtrip(r));
		Runnable r5 = Javapkg.constructGoRunnable();
		r5.run();
	}

	public void testTypedException() {
		InputStream is = new GoInputStream();
		Exception exc = null;
		try {
			is.read();
		} catch (IOException e) {
			exc = e;
		}
		assertNotNull("IOException", exc);
		assertEquals("IOException message", Javapkg.IOExceptionMessage, exc.getMessage());
	}

	public void testInnerClass() {
		Character.Subset s = new Character.Subset(""){};
		Character.Subset s2 = new GoSubset("");
		Javapkg.callSubset(s);
		Javapkg.callSubset(s2);
	}

	public void testNew() {
		Object o = Javapkg.newJavaObject();
		assertTrue("new Object()", o != null);
		Integer i = Javapkg.newJavaInteger();
		assertEquals("new Integer(42)", 42, i.intValue());
	}

	private static class InterfaceRunnable implements I, Runnable {
		@Override public void run() {
		}
	}

	public void testCast() {
		Runnable r1 = new GoRunnable();
		Runnable r1c = Javapkg.castRunnable((Object)r1);
		assertTrue("Casting Go object", r1c != null);
		Runnable r2 = new Runnable() {
			@Override public void run() {
			}
		};
		Runnable r2c = Javapkg.castRunnable((Object)r2);
		assertTrue("Casting Java object", r2c != null);
		Runnable r3c = Javapkg.castInterface(new InterfaceRunnable());
		assertTrue("Casting Go interface implementation", r3c != null);
		Runnable r4c = Javapkg.castRunnable(new Object());
		assertTrue("Invalid cast", r4c == null);
	}

	public void testUnwrap() {
		GoArrayList l = new GoArrayList();
		Javapkg.unwrapGoArrayList(l);
	}
}
