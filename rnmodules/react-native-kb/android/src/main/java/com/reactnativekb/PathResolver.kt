package com.reactnativekb
// part of https://raw.githubusercontent.com/RonRadtke/react-native-blob-util/master/android/src/main/java/com/ReactNativeBlobUtil/Utils/PathResolver.java
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.content.ContentUris
import android.content.ContentResolver

import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;
object PathResolver {
    fun getRealPathFromURI(context: Context?, uri: Uri?): String? {
        if (context == null || uri == null) {
            return null
        }

        // DocumentProvider
        if (DocumentsContract.isDocumentUri(context, uri)) {
            // ExternalStorageProvider
            if (isExternalStorageDocument(uri)) {
                val docId: String = DocumentsContract.getDocumentId(uri)
                val split: List<String?> = docId.split(":")
                val type = split[0]
                if ("primary".equals(type, ignoreCase = true)) {
                    val dir: File? = context.getExternalFilesDir(null)
                    return if (dir != null) dir.toString() + "/" + split[1] else ""
                }

                // TODO handle non-primary volumes
            } else if (isDownloadsDocument(uri)) {
                return try {
                    val id: String = DocumentsContract.getDocumentId(uri)
                    //Starting with Android O, this "id" is not necessarily a long (row number),
                    //but might also be a "raw:/some/file/path" URL
                    if (id.startsWith("raw:/")) {
                        val rawuri: Uri = Uri.parse(id)
                        return rawuri.path
                    }
                    var docId: Long? = null
                    //Since Android 10, uri can start with msf scheme like "msf:12345"
                    if (id.startsWith("msf:")) {
                        val split: List<String?> = id.split(":")
                        val v = split[1]
                        if (v != null) {
                            docId = v.toLong()
                        }
                    } else {
                        docId = id.toLong()
                    }
                    if (docId == null) {
                        return null
                    }
                    val contentUri: Uri = ContentUris.withAppendedId(
                            Uri.parse("content://downloads/public_downloads"), docId)
                    getDataColumn(context, contentUri, null, null)
                } catch (ex: Exception) {
                    //something went wrong, but android should still be able to handle the original uri by returning null here (see readFile(...))
                    null
                }
            } else if (isMediaDocument(uri)) {
                val docId: String = DocumentsContract.getDocumentId(uri)
                val split: List<String?> = docId.split(":")
                val type = split[0]
                val contentUri: Uri? = when (type) {
                    "image" -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    "video" -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    "audio" -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
                    else -> null
                }
                val selection = "_id=?"
                val selectionArgs = arrayOf(
                        split[1]
                )
                return getDataColumn(context, contentUri, selection, selectionArgs)
            } else if ("content".equals(uri.scheme, ignoreCase = true)) {
                // Return the remote address
                return if (isGooglePhotosUri(uri)) uri.lastPathSegment else getDataColumn(context, uri, null, null)
            } else {
                try {
                    val cr = context.contentResolver
                    val attachment: InputStream? = cr.openInputStream(uri)
                    if (attachment != null) {
                        val filename = getContentName(context.contentResolver, uri)
                        if (filename != null) {
                            val file = File(context.cacheDir, filename)
                            val tmp = FileOutputStream(file)
                            val buffer = ByteArray(1024)
                            while (attachment.read(buffer) > 0) {
                                tmp.write(buffer)
                            }
                            tmp.close()
                            attachment.close()
                            return file.absolutePath
                        }
                    }
                } catch (e: Exception) {
                    // ReactNativeBlobUtilUtils.emitWarningEvent(e.toString());
                    return null
                }
            }
        } else if ("content".equals(uri.scheme, ignoreCase = true)) {

            // Return the remote address
            return if (isGooglePhotosUri(uri)) uri.lastPathSegment else getDataColumn(context, uri, null, null)
        } else if ("file".equals(uri.scheme, ignoreCase = true)) {
            return uri.path
        }
        return null
    }

    private fun getContentName(resolver: ContentResolver?, uri: Uri?): String? {
        if (resolver == null || uri == null) {
            return null
        }
        val cursor: Cursor? = resolver.query(uri, null, null, null, null)
        if (cursor == null) {
            return null
        }
        cursor.moveToFirst()
        val nameIndex: Int = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
        if (nameIndex >= 0) {
            val name: String = cursor.getString(nameIndex)
            cursor.close()
            return name
        }
        return null
    }

    /**
     * Get the value of the data column for this Uri. This is useful for
     * MediaStore Uris, and other file-based ContentProviders.
     *
     * @param context       The context.
     * @param uri           The Uri to query.
     * @param selection     (Optional) Filter used in the query.
     * @param selectionArgs (Optional) Selection arguments used in the query.
     * @return The value of the _data column, which is typically a file path.
     */
    fun getDataColumn(context: Context?, uri: Uri?, selection: String?,
                      selectionArgs: Array<String?>?): String? {
        if (context == null || uri == null) {
            return null
        }
        val column = "_data"
        val projection = arrayOf<String?>(
                column
        )
        context.contentResolver.query(uri, projection, selection, selectionArgs,
                null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index: Int = cursor.getColumnIndexOrThrow(column)
                return cursor.getString(index)
            }
        }
        return null
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is ExternalStorageProvider.
     */
    fun isExternalStorageDocument(uri: Uri): Boolean {
        return "com.android.externalstorage.documents" == uri.authority
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is DownloadsProvider.
     */
    fun isDownloadsDocument(uri: Uri): Boolean {
        return "com.android.providers.downloads.documents" == uri.authority
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is MediaProvider.
     */
    fun isMediaDocument(uri: Uri): Boolean {
        return "com.android.providers.media.documents" == uri.authority
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is Google Photos.
     */
    fun isGooglePhotosUri(uri: Uri): Boolean {
        return "com.google.android.apps.photos.content" == uri.authority
    }
}
