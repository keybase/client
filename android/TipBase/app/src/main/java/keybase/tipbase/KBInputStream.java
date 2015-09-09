package keybase.tipbase;

import android.util.Base64;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Iterator;

import static go.keybaselib.Keybaselib.Read;

// Input Stream abstraction over Read();
// Avoids copying bytearrays, and throws away bytes arrays we'll never come back to.
public class KBInputStream extends InputStream {
    private ArrayList<byte[]> bytearrays = new ArrayList<>();
    private int pos = 0;

    private void readMoreBytes() {
        byte[] newBytes = Base64.decode(Read(), Base64.NO_WRAP);
        bytearrays.add(newBytes);
    }

    private int availableBytes() {
        int sum = 0;
        for (byte[] b : bytearrays) {
            sum += b.length;
        }
        return sum;
    }

    private byte readByteAtPos() throws IndexOutOfBoundsException {
        ArrayList<Integer> indicesToClean = new ArrayList<>();
        Iterator<byte[]> it = bytearrays.iterator();
        while (it.hasNext()) {
            byte[] b = it.next();
            if (pos >= b.length) {
                pos -= b.length;
                // clean up old bytearrays we'll no longer come back to.
                it.remove();
                continue;
            }
            return b[pos];
        }
        throw new IndexOutOfBoundsException("Position is ahead of what we have");
    }

    @Override
    public int read() throws IOException {
        if (pos >= availableBytes()) {
            readMoreBytes();
        }
        byte b = readByteAtPos();
        pos++;
        // Stupid java and it's signed bytes.
        return b & 0xff;
    }
}
