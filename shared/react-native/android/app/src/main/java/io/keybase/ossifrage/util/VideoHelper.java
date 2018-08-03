package io.keybase.ossifrage.util;

import android.media.MediaMetadataRetriever;
import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;

public class VideoHelper implements keybase.NativeVideoHelper {
    public byte[] thumbnail(String filename) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        retriever.setDataSource(filename);
        Bitmap bmp = retriever.getPrimaryImage();
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
        return Integer.parseInt(time);
    }
}
