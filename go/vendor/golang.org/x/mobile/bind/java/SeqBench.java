// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package go;

import android.test.InstrumentationTestCase;
import android.util.Log;

import java.util.Map;
import java.util.HashMap;

import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

import benchmark.*;

public class SeqBench extends InstrumentationTestCase {

  public static class AnI implements I {
    @Override public void f() {
    }
  }

  private static class Benchmarks implements benchmark.Benchmarks {
    private static Map<String, Runnable> benchmarks;
    private static ExecutorService executor = Executors.newSingleThreadExecutor();

    static {
      benchmarks = new HashMap<String, Runnable>();
      benchmarks.put("Empty", new Runnable() {
        @Override public void run() {
        }
      });
      benchmarks.put("Noargs", new Runnable() {
        @Override public void run() {
          Benchmark.noargs();
        }
      });
      benchmarks.put("Onearg", new Runnable() {
        @Override public void run() {
          Benchmark.onearg(0);
        }
      });
      benchmarks.put("Manyargs", new Runnable() {
        @Override public void run() {
          Benchmark.manyargs(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
      });
      benchmarks.put("Oneret", new Runnable() {
        @Override public void run() {
          Benchmark.oneret();
        }
      });
      final I javaRef = new AnI();
      benchmarks.put("Refforeign", new Runnable() {
        @Override public void run() {
          Benchmark.ref(javaRef);
        }
      });
      final I goRef = Benchmark.newI();
      benchmarks.put("Refgo", new Runnable() {
        @Override public void run() {
          Benchmark.ref(goRef);
        }
      });
      benchmarks.put("StringShort", new Runnable() {
        @Override public void run() {
          Benchmark.string(Benchmark.ShortString);
        }
      });
      benchmarks.put("StringLong", new Runnable() {
        @Override public void run() {
          Benchmark.string(Benchmark.LongString);
        }
      });
      benchmarks.put("StringShortUnicode", new Runnable() {
        @Override public void run() {
          Benchmark.string(Benchmark.ShortStringUnicode);
        }
      });
      benchmarks.put("StringLongUnicode", new Runnable() {
        @Override public void run() {
          Benchmark.string(Benchmark.LongStringUnicode);
        }
      });
      benchmarks.put("StringRetShort", new Runnable() {
        @Override public void run() {
          Benchmark.stringRetShort();
        }
      });
      benchmarks.put("StringRetLong", new Runnable() {
        @Override public void run() {
          Benchmark.stringRetLong();
        }
      });
      final byte[] shortSlice = Benchmark.getShortSlice();
      benchmarks.put("SliceShort", new Runnable() {
        @Override public void run() {
          Benchmark.slice(shortSlice);
        }
      });
      final byte[] longSlice = Benchmark.getLongSlice();
      benchmarks.put("SliceLong", new Runnable() {
        @Override public void run() {
          Benchmark.slice(longSlice);
        }
      });
    }

    public void runDirect(String name, final long n) {
      final Runnable r = benchmarks.get(name);
      try {
        executor.submit(new Runnable() {
          @Override public void run() {
            for (int i = 0; i < n; i++) {
              r.run();
            }
          }
        }).get();
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
    }

    public void run(String name, long n) {
      final Runnable r = benchmarks.get(name);
      for (int i = 0; i < n; i++) {
        r.run();
      }
    }

    @Override public I newI() {
      return new AnI();
    }
    @Override public void ref(I i) {
    }
    @Override public void noargs() {
    }
    @Override public void onearg(long i) {
    }
    @Override public long oneret() {
      return 0;
    }
    @Override public void manyargs(long p0, long p1, long p2, long p3, long p4, long p5, long p6, long p7, long gp8, long p9) {
    }
    @Override public void string(String s) {
    }
    @Override public void slice(byte[] s) {
    }
	@Override public String stringRetShort() {
		return Benchmark.ShortString;
	}
	@Override public String stringRetLong() {
		return Benchmark.LongString;
	}
  }

  public void testBenchmark() {
    Benchmark.runBenchmarks(new Benchmarks());
  }
}
