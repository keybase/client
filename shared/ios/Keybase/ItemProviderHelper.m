//
//  ItemProviderHelper.m
//  Keybase
//
//  Created by Chris Nojima on 9/13/22.
//  Copyright © 2022 Keybase. All rights reserved.
//

#import "ItemProviderHelper.h"
#import "MediaUtils.h"
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <MobileCoreServices/UTCoreTypes.h>
#import <MobileCoreServices/UTType.h>

@interface ItemProviderHelper ()
@property (nonatomic, strong) NSArray * itemArrs;
@property (nonatomic, strong) NSURL * payloadFolderURL;
@property (nonatomic, strong) NSArray* attributedContentTexts;
@property BOOL isShare;
@property BOOL done;
@property (nonatomic, copy) void (^completionHandler)(void);

// edited while processing
@property NSInteger unprocessed;
@property (nonatomic, strong) NSString* attributedContentText;
@end

@implementation ItemProviderHelper

- (void) completeProcessingItemAlreadyInMainThread {
  NSLog(@"aaa completeProcessingItemAlreadyInMainThread %ld", (long)self.unprocessed);
  // more to process
  if(--self.unprocessed > 0) {
    return;
  }
  // done
  else if (!self.done) {
    self.done = YES;
    [self writeManifest];
    self.completionHandler();
  } else {
    // already done?
  }
}

- (NSURL *)getIncomingShareFolder {
  NSURL* containerURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier: @"group.keybase"];
  // Use the cache URL so if we fail to clean up payloads they can be deleted by the OS.
  NSURL* cacheURL = [[containerURL URLByAppendingPathComponent:@"Library" isDirectory:true] URLByAppendingPathComponent:@"Caches" isDirectory:true];
  NSURL* incomingShareFolderURL = [cacheURL URLByAppendingPathComponent:@"incoming-shares" isDirectory:true];
  return incomingShareFolderURL;
}

- (NSURL*)makePayloadFolder {
  NSURL* incomingShareFolderURL = [self getIncomingShareFolder];
  NSString* guid = [[NSProcessInfo processInfo] globallyUniqueString];
  NSURL* payloadFolderURL = [incomingShareFolderURL URLByAppendingPathComponent:guid isDirectory:true];
  [[NSFileManager defaultManager] createDirectoryAtURL:payloadFolderURL withIntermediateDirectories:YES attributes:nil error:nil];
  return payloadFolderURL;
}

-(id) initForShare: (BOOL) isShare withItems: (NSArray*) itemArrs attrStrings: (NSArray *) sArrs completionHandler:(nonnull void (^)(void))handler {
  if (self = [super init]) {
    self.isShare = isShare;
    self.itemArrs = itemArrs;
    self.attributedContentTexts = sArrs;
    self.unprocessed = 0;
    self.completionHandler = handler;
    self.manifest = [[NSMutableArray alloc] init];
    self.payloadFolderURL = [self makePayloadFolder];
    
    NSLog(@"aaa initForShare \n%@\n%@\n", itemArrs, sArrs);
    //    if (self.unprocessed == 0) {
    //      self.completionHandler();
    //    }
  }
  return self;
}

- (NSURL*)getPayloadURLFromURL:(NSURL *)fileUrl {
  NSString* guid = [[NSProcessInfo processInfo] globallyUniqueString];
  return fileUrl ? [self.payloadFolderURL URLByAppendingPathComponent:[fileUrl lastPathComponent]] : [self.payloadFolderURL URLByAppendingPathComponent:guid];
}

- (NSURL*)getPayloadURLFromExt:(NSString *)ext {
  NSString* guid = [[NSProcessInfo processInfo] globallyUniqueString];
  return ext ? [[self.payloadFolderURL URLByAppendingPathComponent:guid] URLByAppendingPathExtension:ext] : [self.payloadFolderURL URLByAppendingPathComponent:guid];
}

- (NSURL*)getManifestFileURL {
  NSURL* incomingShareFolderURL = [self getIncomingShareFolder];
  [[NSFileManager defaultManager] createDirectoryAtURL:incomingShareFolderURL withIntermediateDirectories:YES attributes:nil error:nil];
  return [incomingShareFolderURL URLByAppendingPathComponent:@"manifest.json"];
}

- (void)completeItemAndAppendManifestType:(NSString*)type originalFileURL:(NSURL*) originalFileURL {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.manifest addObject: @{
      @"type": type,
      @"originalPath":[originalFileURL absoluteURL].path,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

// No path; this is chatOnly.
- (void)completeItemAndAppendManifestType:(NSString*)type content:(NSString*)content {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.manifest addObject: @{
      @"type": type,
      @"content": content,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestType:(NSString*)type originalFileURL:(NSURL*) originalFileURL content:(NSString*)content {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.manifest addObject: @{
      @"type": type,
      @"originalPath":[originalFileURL absoluteURL].path,
      @"content": content,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestType:(NSString*)type originalFileURL:(NSURL*) originalFileURL scaledFileURL:(NSURL*)scaledFileURL thumbnailFileURL:(NSURL*)thumbnailFileURL {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.manifest addObject: @{
      @"type": type,
      @"originalPath":[originalFileURL absoluteURL].path,
      @"scaledPath":[scaledFileURL absoluteURL].path,
      @"thumbnailPath":[thumbnailFileURL absoluteURL].path,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestAndLogErrorWithText:(NSString*)text error:(NSError*)error {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.manifest addObject:@{
      @"error": [NSString stringWithFormat:@"%@: %@", text, error != nil ? error : @"<empty>"],
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (NSError *)writeManifest {
  NSURL* fileURL = [self getManifestFileURL];
  NSOutputStream * output = [NSOutputStream outputStreamWithURL:fileURL append:false];
  [output open];
  NSError * error;
  [NSJSONSerialization writeJSONObject:self.manifest toStream:output options:0 error:&error];
  return error;
}

NSInteger TEXT_LENGTH_THRESHOLD = 1000; // TODO make this match the actual limit in chat

//- (void) handleText:(NSString *)text chatOnly:(BOOL)chatOnly loadError:(NSError *)error {
//  if (chatOnly && text.length < TEXT_LENGTH_THRESHOLD) {
//    [self completeItemAndAppendManifestType:@"text" content:text];
//    return;
//  } // If length is too large, just ignore the chatOnly flag.
//
//  // We write the text into a file regardless because this could go to KBFS.
//  // But if the text is short enough, we also include it in the manifest so
//  // GUI can easily pre-fill it into the chat compose box.
//  if (error != nil) {
//    [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: load error" error:error];
//    return;
//  }
//  NSURL * originalFileURL = [self getPayloadURLFromExt:@"txt"];
//  [text writeToURL:originalFileURL atomically:true encoding:NSUTF8StringEncoding error:&error];
//  if (error != nil){
//    [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: unable to write payload file" error:error];
//    return;
//  }
//  if (text.length < TEXT_LENGTH_THRESHOLD) {
//    [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL content:text];
//  } else {
//    [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL];
//  }
//}
//
- (void) handleAndCompleteMediaFile:(NSURL *)url isVideo:(BOOL)isVideo {
  ProcessMediaCompletion completion = ^(NSError * error, NSURL * scaled, NSURL * thumbnail) {
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleAndCompleteMediaFile" error:error];
      return;
    }
    [self completeItemAndAppendManifestType: isVideo ? @"video" : @"image" originalFileURL:url scaledFileURL:scaled thumbnailFileURL:thumbnail];
  };
  if (isVideo) {
    [MediaUtils processVideoFromOriginal:url completion:completion];
  } else {
    [MediaUtils processImageFromOriginal:url completion:completion];
  }
}

// processItem will invoke the correct function on the Go side for the given attachment type.
//- (void)processItem:(NSItemProvider*)item {
//  // It's hard to figure out what will actually decode so we try a bunch of methods and keep falling back
//  NSMutableArray * decodes = [NSMutableArray new];
//
//  void (^tryNextDecode)(void) = ^void() {
//    if (decodes.count == 0) {
//      [self completeItemAndAppendManifestAndLogErrorWithText:@"dataHandler: unable to decode share" error:nil];
//      return;
//    }
//
//    void (^next)(void) = [decodes objectAtIndex:0];
//    [decodes removeObjectAtIndex:0];
//    next();
//  };
//
//
//  NSItemProviderCompletionHandler urlHandler = ^(NSURL* url, NSError* error) {
//    if (self.attributedContentText.length > 0){
//      [self handleText: [NSString stringWithFormat:@"%@ %@", self.attributedContentText, url.absoluteString] chatOnly:true loadError:error];
//    }else{
//      [self handleText: url.absoluteString chatOnly:true loadError:error];
//    }
//  };
//
//  NSItemProviderCompletionHandler dataHandler = ^(NSData* data, NSError* error) {
//    if (error != nil) {
//      tryNextDecode();
//      return;
//    }
//    NSURL* filePayloadURL = [self getPayloadURLFromExt:@"data"];
//    BOOL OK = [data writeToURL:filePayloadURL atomically:true];
//    if (!OK) {
//      tryNextDecode();
//      return;
//    }
//    [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
//  };
//
//  NSItemProviderCompletionHandler fileHandlerSimple = ^(NSURL* url, NSError* error) {
//    if (error != nil) {
//      tryNextDecode();
//      return;
//    }
//    NSURL * filePayloadURL = [self getPayloadURLFromURL:url];
//    [[NSFileManager defaultManager] copyItemAtURL:url toURL:filePayloadURL error:&error];
//    if (error != nil) {
//      [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandlerSimple: copy error" error:error];
//      return;
//    }
//    [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
//  };
//
//  NSItemProviderCompletionHandler textHandler = ^(NSString* text, NSError* error) {
//    if (error != nil) {
//      tryNextDecode();
//      return;
//    }
//    [self handleText:text chatOnly:false loadError:error];
//  };
//
//  NSItemProviderCompletionHandler imageHandler = ^(UIImage* image, NSError* error) {
//    if (error != nil) {
//      tryNextDecode();
//      return;
//    }
//    CGImageAlphaInfo alpha = CGImageGetAlphaInfo(image.CGImage);
//    BOOL hasAlpha = (
//                     alpha == kCGImageAlphaFirst ||
//                     alpha == kCGImageAlphaLast ||
//                     alpha == kCGImageAlphaPremultipliedFirst ||
//                     alpha == kCGImageAlphaPremultipliedLast
//                     );
//    NSData * imageData = hasAlpha ? UIImagePNGRepresentation(image) : UIImageJPEGRepresentation(image, .85);
//    NSURL * originalFileURL = [self getPayloadURLFromExt: hasAlpha ? @"png" : @"jpg"];
//    BOOL OK = [imageData writeToURL:originalFileURL atomically:true];
//    if (!OK){
//      tryNextDecode();
//      return;
//    }
//    [self handleAndCompleteMediaFile:originalFileURL isVideo:false ];
//  };
//
//  // The NSItemProviderCompletionHandler interface is a little tricky. The caller of our handler
//  // will inspect the arguments that we have given, and will attempt to give us the attachment
//  // in this form. For files, we always want a file URL, and so that is what we pass in.
//  NSItemProviderCompletionHandler fileHandlerMedia = ^(NSURL* url, NSError* error) {
//    BOOL hasImage = [item hasItemConformingToTypeIdentifier:@"public.image"];
//    BOOL hasVideo = [item hasItemConformingToTypeIdentifier:@"public.movie"];
//
//    if (error != nil) {
//      tryNextDecode();
//      return;
//    }
//
//    NSURL * filePayloadURL = [self getPayloadURLFromURL:url];
//    [[NSFileManager defaultManager] copyItemAtURL:url toURL:filePayloadURL error:&error];
//    if (error != nil) {
//      tryNextDecode();
//      return;
//    }
//
//    if (hasVideo) {
//      [self handleAndCompleteMediaFile:filePayloadURL isVideo:true];
//    } else if (hasImage) {
//      [self handleAndCompleteMediaFile:filePayloadURL isVideo:false];
//    } else {
//      [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
//    }
//  };
//
//#pragma mark actually figuring out how to handle types
//
//  if ([item hasItemConformingToTypeIdentifier:@"public.movie"]) {
//    if (self.isShare) {
//      [decodes addObject:^(){
//        [item loadItemForTypeIdentifier:@"public.movie" options:nil completionHandler:fileHandlerMedia];
//      }];
//
//    } else {
//      // drag drop doesn't give us working urls
//      [decodes addObject:^(){
//        [item loadFileRepresentationForTypeIdentifier:@"public.movie" completionHandler:fileHandlerMedia];
//      }];
//    }
//  }
//
//  if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
//    if (self.isShare) {
//
//      // Use the fileHandler here, so if the image is from e.g. the Photos app,
//      // we'd go with the copy routine instead of having to encode an NSImage.
//      // This is important for staying under the mem limit.
//      [decodes addObject:^(){
//        [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:fileHandlerMedia];
//      }];
//      [decodes addObject:^(){
//        [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:imageHandler];
//      }];
//      // drag drop doesn't give us working urls
//      [decodes addObject:^(){
//        [item loadObjectOfClass:[UIImage class] completionHandler:imageHandler];
//      }];
//    } else {
//      // drag drop doesn't give us working urls, must be the first thing we try
//      [decodes addObject:^(){
//        [item loadObjectOfClass:[UIImage class] completionHandler:imageHandler];
//      }];
//      [decodes addObject:^(){
//        [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:imageHandler];
//      }];
//      [decodes addObject:^(){
//        [item loadFileRepresentationForTypeIdentifier:@"public.image" completionHandler:fileHandlerMedia];
//      }];
//    }
//  }
//  if ([item hasItemConformingToTypeIdentifier:@"public.file-url"]) {
//    if (self.isShare) {
//      // Although this will be covered in the catch-all below, do it before public.text and public.url so that we get the file instead of a web URL when user shares a downloaded file from safari.
//      [decodes addObject:^(){
//        [item loadItemForTypeIdentifier:@"public.file-url" options:nil completionHandler:fileHandlerSimple];
//      }];
//    } else {
//      [decodes addObject:^(){
//        [item loadFileRepresentationForTypeIdentifier:@"public.file-url" completionHandler:fileHandlerSimple];
//      }];
//    }
//  }
//  if ([item hasItemConformingToTypeIdentifier:@"public.text"]) {
//    if (self.isShare) {
//      [decodes addObject:^(){
//        [item loadItemForTypeIdentifier:@"public.text" options:nil completionHandler:textHandler];
//      }];
//    } else {
//      [decodes addObject:^(){
//        [item loadObjectOfClass:NSString.class completionHandler:textHandler];
//      }];
//    }
//  }
//  if ([item hasItemConformingToTypeIdentifier:@"public.url"]) {
//    if (self.isShare) {
//      [decodes addObject:^(){
//        [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:urlHandler];
//      }];
//    } else {
//      [decodes addObject:^(){
//        [item loadObjectOfClass:[NSString class] completionHandler:textHandler];
//      }];
//    }
//  }
//
//  if (self.isShare) {
//    // catch-all, including file-url or stuff like pdf from safari, or contact card.
//    [decodes addObject:^(){
//      [item loadItemForTypeIdentifier:@"public.item" options:nil completionHandler: fileHandlerSimple];
//    }];
//  } else {
//    [decodes addObject:^(){
//      [item loadFileRepresentationForTypeIdentifier:@"public.item" completionHandler:fileHandlerSimple];
//    }];
//  }
//
//  tryNextDecode();
//
//}



  

 

// new method, try and deprecate processItem
/**
 How this works:
 On a share we get an array of inputItems. Each inputItem has a metadata string and an array of NSItemProviders. Depending on the sending app
 we can get one inputItem and then an array of itemProviders, or we can get many inputItems with many itemProviders etc
 The itemProviders give an ordered list of representations to use. The NSItemProvider API has a binary API and a coercing API
 We attempt to use the binary API to explicitly ask for certain data types (png, gif, plainTextutf8 etc). If we can't resolve that we go down into very
 generic types (image, text) which we have to use the (worse) coercing types to get the framework to peer into the data and do the right thing.
 This approach seems to give us the best chance to decode these attachments. It really varies wildly depending on the app and apple itself
 doesn't give you nice types on old apps (app store, etc)
 
 
 */
-(void) startProcessing {
  NSArray * types = @[ @"public.item", @"public.content", @"public.composite-content", @"public.message", @"public.contact", @"public.archive", @"public.disk-image", @"public.data", @"public.directory", @"com.apple.resolvable", @"public.symlink", @"public.executable", @"com.apple.mount-point", @"com.apple.alias-file", @"com.apple.alias-record", @"com.apple.bookmark", @"public.url", @"public.file-url", @"public.text", @"public.plain-text", @"public.utf8-plain-text", @"public.utf16-external-plain-text", @"public.utf16-plain-text", @"public.delimited-values-text", @"public.comma-separated-values-text", @"public.tab-separated-values-text", @"public.utf8-tab-separated-values-text", @"public.rtf", @"public.html", @"public.xml", @"public.source-code", @"public.assembly-source", @"public.c-source", @"public.objective-c-source", @"public.swift-source", @"public.c-plus-plus-source", @"public.objective-c-plus-plus-source", @"public.c-header", @"public.c-plus-plus-header", @"com.sun.java-source", @"public.script", @"com.apple.applescript.text", @"com.apple.applescript.script", @"com.apple.applescript.script-bundle", @"com.netscape.javascript-source", @"public.shell-script", @"public.perl-script", @"public.python-script", @"public.ruby-script", @"public.php-script", @"public.json", @"com.apple.property-list", @"com.apple.xml-property-list", @"com.apple.binary-property-list", @"com.adobe.pdf", @"com.apple.rtfd", @"com.apple.flat-rtfd", @"com.apple.txn.text-multimedia-data", @"com.apple.webarchive", @"public.image", @"public.jpeg", @"public.jpeg-2000", @"public.tiff", @"com.apple.pict", @"com.compuserve.gif", @"public.png", @"com.apple.quicktime-image", @"com.apple.icns", @"com.microsoft.bmp", @"com.microsoft.ico", @"public.camera-raw-image", @"public.svg-image", @"com.apple.live-photo", @"public.audiovisual-content", @"public.movie", @"public.video", @"public.audio", @"com.apple.quicktime-movie", @"public.mpeg", @"public.mpeg-2-video", @"public.mpeg-2-transport-stream", @"public.mp3", @"public.mpeg-4", @"public.mpeg-4-audio", @"com.apple.protected-mpeg-4-audio", @"com.apple.protected-mpeg-4-video", @"public.avi", @"public.aiff-audio", @"com.microsoft.waveform-audio", @"public.midi-audio", @"public.playlist", @"public.m3u-playlist", @"public.folder", @"public.volume", @"com.apple.package", @"com.apple.bundle", @"com.apple.plugin", @"com.apple.metadata-importer", @"com.apple.quicklook-generator", @"com.apple.xpc-service", @"com.apple.framework", @"com.apple.application", @"com.apple.application-bundle", @"com.apple.application-file", @"public.unix-executable", @"com.microsoft.windows-executable", @"com.sun.java-class", @"com.sun.java-archive", @"com.apple.systempreference.prefpane", @"org.gnu.gnu-zip-archive", @"public.bzip2-archive", @"public.zip-archive", @"public.spreadsheet", @"public.presentation", @"public.database", @"public.vcard", @"public.to-do-item", @"public.calendar-event", @"public.email-message", @"com.apple.internet-location", @"com.apple.ink.inktext", @"public.font", @"public.bookmark", @"public.3d-content", @"com.rsa.pkcs-12", @"public.x509-certificate", @"org.idpf.epub-container", @"public.log"];
  
  NSItemProviderCompletionHandler fileHandlerSimple2 = ^(id<NSSecureCoding> item, NSError* error) {
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandlerSimple: unable to decode share" error:error];
      return;
    }
    
    NSURL * url = nil;
    if([(NSObject*)item isKindOfClass:[NSURL class]]) {
      url = (NSURL*)item;
    } else {
      NSLog(@"aaa non url?");
      [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandlerSimple: non url?" error:nil];
    }
    
    NSURL * filePayloadURL = [self getPayloadURLFromURL:url];
    [[NSFileManager defaultManager] copyItemAtURL:url toURL:filePayloadURL error:&error];
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandlerSimple: copy error" error:error];
      return;
    }
    [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
  };
  
  NSItemProviderCompletionHandler coerceImageHandlerSimple2 = ^(id<NSSecureCoding> item , NSError* error) {
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"itemHandlerSimple2: unable to decode share" error:error];
      return;
    }
    
    NSData *imgData;
    if([(NSObject*)item isKindOfClass:[NSURL class]]) {
      imgData = [NSData dataWithContentsOfURL:(NSURL*)item];
      if (imgData) {
        UIImage *image = [UIImage imageWithData:imgData];
        imgData = UIImageJPEGRepresentation(image, 0.85);
      }
    }
    if([(NSObject*)item isKindOfClass:[UIImage class]]) {
      imgData = UIImageJPEGRepresentation((UIImage*)item, 0.85);
    }
  
      NSURL * originalFileURL = [self getPayloadURLFromExt: @"jpg"];
      BOOL OK = [imgData writeToURL:originalFileURL atomically:true];
      if (!OK){
        [self completeItemAndAppendManifestAndLogErrorWithText:@"itemHandlerSimple2: unable to decode share" error:error];
        return;
      }
      [self handleAndCompleteMediaFile:originalFileURL isVideo:false ];
  };
  
  NSItemProviderCompletionHandler coerceTextHandler2 = ^(id<NSSecureCoding> item, NSError* error) {
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: load error" error:error];
      return;
    }
    
    NSString* text = nil;
    if([(NSObject*)item isKindOfClass:[NSString class]]) {
      text = (NSString*)item;
    } else if([(NSObject*)item isKindOfClass:[NSURL class]]) {
      NSURL * url = (NSURL*)item;
      text = url.absoluteString;
      // not a user url
      if ([text hasPrefix:@"file://"]) {
        NSData * d = [NSData dataWithContentsOfURL:url];
        text = [[NSString alloc] initWithData:d encoding:NSUTF8StringEncoding];
      }
    } else {
      NSLog(@"aaa non text?");
      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: non text" error:nil];
    }
    
    if (text.length < TEXT_LENGTH_THRESHOLD) {
      [self completeItemAndAppendManifestType:@"text" content:text];
      return;
    }
    
    NSURL * originalFileURL = [self getPayloadURLFromExt:@"txt"];
    [text writeToURL:originalFileURL atomically:true encoding:NSUTF8StringEncoding error:&error];
    if (error != nil){
      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: unable to write payload file" error:error];
      return;
    }
    
    [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL];
  };
  
  int idx = 0;
  BOOL handled = NO;
  for (NSArray * items in self.itemArrs) {
    self.attributedContentText = self.attributedContentTexts[idx];
    ++idx;

    for (NSItemProvider * item in items) {  
      for (NSString * s in types) {
        if ([item hasItemConformingToTypeIdentifier:s]) {
          NSLog(@"aaa hasconform %@", s);
        }
      }
      
      
      NSLog(@"aaa reg: %@", item.registeredTypeIdentifiers);
      for (NSString * stype in item.registeredTypeIdentifiers) {
        NSLog(@"aaa stype: %@", stype);
        if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeMovie)) {
          NSLog(@"aaa movie");
          self.unprocessed++;
          handled = YES;
          [item loadFileRepresentationForTypeIdentifier:stype completionHandler:fileHandlerSimple2];
          break;
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypePNG) ||
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeGIF) ||
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeJPEG)
                   ) {
          NSLog(@"aaa image");
          handled = YES;
          self.unprocessed++;
          [item loadFileRepresentationForTypeIdentifier:stype completionHandler:fileHandlerSimple2];
          break;
        } else if ([stype isEqual:@"public.heic"]) {
          NSLog(@"aaa heic");
          handled = YES;
          self.unprocessed++;
          [item loadFileRepresentationForTypeIdentifier:@"public.heic" completionHandler:fileHandlerSimple2];
          break;
        } if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeImage)) {
          NSLog(@"aaa generic image?");
          self.unprocessed++;
          handled = YES;
          [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:coerceImageHandlerSimple2];
          break;
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypePlainText)) {
          NSLog(@"aaa plaintext");
          handled = YES;
          self.unprocessed++;
          [item loadItemForTypeIdentifier:@"public.plain-text" options:nil completionHandler:coerceTextHandler2];
          break;
        }
        else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeFileURL)) {
          handled = YES;
          self.unprocessed++;
          // this is a local url and not something to show to the user, instead we download it
          [item loadFileRepresentationForTypeIdentifier: @"public.item" completionHandler:fileHandlerSimple2];
          break;
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeURL)) {
          NSLog(@"aaa url");
          handled = YES;
          self.unprocessed++;
          [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:coerceTextHandler2];
          break;
          
        }
      }
    }
  }
  
  // TODO didn't handle anything
  if (!handled) {
    NSLog(@"aaa fallback");
    // try super generic
//    [item loadFileRepresentationForTypeIdentifier: @"public.item" completionHandler:fileHandlerSimple2];
  }
  
  self.unprocessed++;
  // in case we didn't find anything clean up
  dispatch_async(dispatch_get_main_queue(), ^{
    [self completeProcessingItemAlreadyInMainThread];
  });
}

//NSItemProviderCompletionHandler textFileHandlerSimple2 = ^(NSURL* url, NSError* error) {
//  if (error != nil) {
//    [self completeItemAndAppendManifestAndLogErrorWithText:@"textFileHandlerSimple: unable to decode share" error:error];
//    return;
//  }
//  
//  NSURL * filePayloadURL = [self getPayloadURLFromURL:url];
//  [[NSFileManager defaultManager] copyItemAtURL:url toURL:filePayloadURL error:&error];
//  if (error != nil) {
//    [self completeItemAndAppendManifestAndLogErrorWithText:@"textFileHandlerSimple: copy error" error:error];
//    return;
//  }
//  
//  // try and extract
//  NSData * urlData = [NSData dataWithContentsOfURL:filePayloadURL];
//  if (urlData) {
//    NSString* str = [[NSString alloc] initWithData:urlData encoding:NSUTF8StringEncoding];
//    if (str.length < TEXT_LENGTH_THRESHOLD) {
//      [self completeItemAndAppendManifestType:@"text" content:str];
//      return;
//    }
//  }
//  [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
//};

//  NSItemProviderCompletionHandler textHandler3 = ^(id item, NSError* error) {
//    if (error != nil) {
//      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: load error" error:error];
//      return;
//    }
//
//    if (![item isKindOfClass:[NSData class]]) {
//      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: load error" error:error];
//      return;
//    }
//
//    NSString *text = [[NSString alloc] initWithData:(NSData *)item encoding:NSUTF8StringEncoding];
//    if (!text || text.length) {
//      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: load error" error:error];
//      return;
//    }
//
//    if (text.length < TEXT_LENGTH_THRESHOLD) {
//      [self completeItemAndAppendManifestType:@"text" content:text];
//      return;
//    }
//
//    NSURL * originalFileURL = [self getPayloadURLFromExt:@"txt"];
//    [text writeToURL:originalFileURL atomically:true encoding:NSUTF8StringEncoding error:&error];
//    if (error != nil){
//      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: unable to write payload file" error:error];
//      return;
//    }
//
//    [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL];
//  };


//NSItemProviderCompletionHandler textHandler2 = ^(NSString* text, NSError* error) {
//  if (error != nil) {
//    [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: load error" error:error];
//    return;
//  }
//  
//  if (text.length < TEXT_LENGTH_THRESHOLD) {
//    [self completeItemAndAppendManifestType:@"text" content:text];
//    return;
//  }
//  
//  NSURL * originalFileURL = [self getPayloadURLFromExt:@"txt"];
//  [text writeToURL:originalFileURL atomically:true encoding:NSUTF8StringEncoding error:&error];
//  if (error != nil){
//    [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: unable to write payload file" error:error];
//    return;
//  }
//  
//  [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL];
//};
// TODO low memory use url only? share sheet?
// TODO maybe heic actually just works w/ expo-image
//typedef void (NS_SWIFT_SENDABLE ^FileCompletionHandler)(NSURL *_Nullable URL, BOOL openInPlace, NSError *_Nullable error);
/*UTType * uttype = [UTType typeWithIdentifier:stype];
if ([uttype conformsToType:UTTypePNG]) {
  
}*/



@end
