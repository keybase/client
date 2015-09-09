package keybase.tipbase;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.widget.TextView;

import org.msgpack.MessagePack;
import org.msgpack.annotation.Message;
import org.msgpack.packer.Packer;
import org.msgpack.type.Value;
import org.msgpack.unpacker.Unpacker;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import rx.Observable;
import rx.android.schedulers.AndroidSchedulers;
import rx.functions.Action1;
import rx.schedulers.Schedulers;

import static go.keybaselib.Keybaselib.Write;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = MainActivity.class.getName();

    // TODO: Seems like we don't use types in msgpack?
    // we seem to just use maps instead of letting msgpack know about types?
    @Message
    public static class MyMessage {
        // public fields are serialized.
        public String name;
        public int sessionId;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        final TextView textView = (TextView) findViewById(R.id.mainText);


        textView.setText("Counting from Go: " + 123);

        final MessagePack msgpack = new MessagePack();


        String method = "keybase.1.test.testCallback";

        Map<String, Object> args = new HashMap<String, Object>();
        args.put("sessionId", 1);
        args.put("name", "123");

        try {
            writeMessage(msgpack, 1, method, args);
        } catch (IOException e) {
            e.printStackTrace();
        }

        ReadMessage()
          .subscribeOn(Schedulers.io())
          .observeOn(AndroidSchedulers.mainThread())
          .subscribe(new Action1<Value>() {
              @Override
              public void call(Value value) {
                  String result = value.asRawValue().getString();
                  textView.setText("Counting: " + result);

                  String method = "keybase.1.test.testCallback";

                  Map<String, Object> args = new HashMap<String, Object>();
                  args.put("sessionId", 1);
                  args.put("name", result);
                  try {
                      writeMessage(msgpack, 1, method, args);
                  } catch (IOException e) {
                      e.printStackTrace();
                  }
              }
          });

    }

    public void writeMessage(MessagePack msgpack, int msgid, String methodName, Map args) throws IOException {
        ByteArrayOutputStream unframedMsg = new ByteArrayOutputStream();
        Packer packer = msgpack.createPacker(unframedMsg);
        packMessage(packer, msgid, methodName, args);

        ByteArrayOutputStream framedMsg = new ByteArrayOutputStream();
        Packer framedPacker = msgpack.createPacker(framedMsg);

        // Write the size of the message
        packer.write(unframedMsg.size());
        packMessage(framedPacker, msgid, methodName, args);


        String b64 = Base64.encodeToString(framedMsg.toByteArray(), Base64.NO_WRAP);
        Write(b64);
    }

    // TODO: fix this for multi arg methods.
    public void packMessage(Packer packer, int msgid, String methodName, Map args) throws IOException {

        packer.write(0);
        packer.writeArrayBegin(4);
        // type
        packer.write(0);
        // msgid
        packer.write(1);
        // method name
        packer.write(methodName);
        // args
        packer.writeArrayBegin(1);
        packer.write(args);
        packer.writeArrayEnd();
        packer.writeArrayEnd();
    }


    // This will handle reading full messages from the RPC Read
    // TODO: This should be a singleton that returns the same observable
    public Observable<Value> ReadMessage(){
        return Observable.create(new Observable.OnSubscribe<Value>(){
            @Override
            public void call(rx.Subscriber<? super Value> subscriber) {
                // Make sure someone is listening
                int msgSize = 0;
                KBInputStream kblibStream = new KBInputStream();
                MessagePack msgpack = new MessagePack();

                while (!subscriber.isUnsubscribed()) {
                    // Get the size of the msgSize
                    try {
                        Unpacker unpacker = msgpack.createUnpacker(kblibStream);
                        msgSize = unpacker.readInt();
                        Log.d(TAG, "Message Size will be: " + msgSize);
                        unpacker.readArrayBegin();
                        int type = unpacker.readInt();
                        int msgid = unpacker.readInt();
                        Value error = unpacker.readValue();
                        Value responseVal = unpacker.readValue();
                        unpacker.readArrayEnd();

                        subscriber.onNext(responseVal);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }

                }
            }
        });
    }
}
