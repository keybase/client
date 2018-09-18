package io.keybase.ossifrage.util;

import android.media.MediaMetadataRetriever;
import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;

public class VideoHelper implements keybase.NativeVideoHelper {
    public byte[] thumbnail(String filename) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        retriever.setDataSource(filename);
        Bitmap bmp = retriever.getFrameAtTime();
        ByteArrayOutputStream stream = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 100, stream);
        byte[] ret = stream.toByteArray();
        retriever.release();
        return ret;
    }
    public long duration(String filename) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        retriever.setDataSource(filename);
        String time = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
        if (time == null) {
            return 0;
        }
        int ret = Integer.parseInt(time);
        retriever.release();
        return ret;
    }
}
