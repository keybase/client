package com.reactnativekb

import android.content.Context
import android.system.ErrnoException
import android.system.Os
import java.io.File
import java.io.IOException
import java.util.UUID

// Files shared out of the app are placed here first. The outbox provider
// (res/xml/fileprovider.xml) serves only this directory and Download/Keybase/,
// where androidOpenFile finds files saved below Android 10, so a uri it hands
// out can only ever name an item put here for sharing or a saved download.
object ShareOutbox {
    // Must match the cache-path in res/xml/fileprovider.xml.
    private const val DIR_NAME = "share-outbox"

    // The app shared to may read the item well after the share, e.g. a queued
    // upload, so items are kept longer than incoming copies.
    private const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000

    // Must match the SharedFileProvider authority in AndroidManifest.xml.
    fun authority(context: Context) = "${context.packageName}.shareoutbox"

    fun dir(context: Context): File {
        val dir = File(context.cacheDir, DIR_NAME)
        dir.mkdirs()
        return dir
    }

    // Puts file in the outbox as its own item and returns the item. Only files
    // under cacheDir can be shared. A hard link avoids copying; the copy is the
    // fallback. On any failure nothing is left behind.
    fun add(context: Context, file: File): File {
        val cache = context.cacheDir.canonicalFile
        val source = file.canonicalFile
        if (!source.path.startsWith(cache.path + File.separator) || !source.isFile) {
            throw IOException("only files in the cache dir can be shared")
        }
        val itemDir = File(dir(context), UUID.randomUUID().toString())
        if (!itemDir.mkdirs()) {
            throw IOException("unable to create ${itemDir.path}")
        }
        val item = File(itemDir, IncomingShareFileName.make(source.name, null))
        try {
            try {
                Os.link(source.path, item.path)
            } catch (e: ErrnoException) {
                source.inputStream().use { input -> item.outputStream().use { input.copyTo(it, 64 * 1024) } }
            }
        } catch (e: Exception) {
            itemDir.deleteRecursively()
            throw e
        }
        return item
    }

    // Removes an item add returned.
    fun remove(item: File) {
        item.parentFile?.deleteRecursively()
    }

    // Call off the main thread: this stats every item.
    fun purgeOld(context: Context) = IncomingShareCache.purgeOld(dir(context), MAX_AGE_MS)
}
