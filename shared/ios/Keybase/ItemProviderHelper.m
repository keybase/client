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
#import <Contacts/CNContactVCardSerialization.h>
#import <Contacts/CNContact.h>
#import <Contacts/CNContactFormatter.h>
#import <Contacts/CNPostalAddressFormatter.h>


@interface ItemProviderHelper ()
@property (nonatomic, strong) NSArray * itemArrs;
@property (nonatomic, strong) NSURL * payloadFolderURL;
@property BOOL isShare;
@property BOOL done;
@property (nonatomic, strong) NSMutableDictionary * typeToArray;
@property (nonatomic, copy) void (^completionHandler)(void);

// edited while processing
@property NSInteger unprocessed;
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

-(id) initForShare: (BOOL) isShare withItems: (NSArray*) itemArrs completionHandler:(nonnull void (^)(void))handler {
  if (self = [super init]) {
    self.isShare = isShare;
    self.itemArrs = itemArrs;
    self.unprocessed = 0;
    self.completionHandler = handler;
    self.typeToArray = [[NSMutableDictionary alloc] init];
    self.payloadFolderURL = [self makePayloadFolder];
    
    NSLog(@"aaa initForShare \n%@\n", itemArrs);
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
    NSMutableArray * arr = self.typeToArray[type];
    if (!arr) {
      arr = [[NSMutableArray alloc] init];
      self.typeToArray[type] = arr;
    }
    [arr addObject: @{
      @"type": type,
      @"originalPath":[originalFileURL absoluteURL].path,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

// No path; this is chatOnly.
- (void)completeItemAndAppendManifestType:(NSString*)type content:(NSString*)content {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray * arr = self.typeToArray[type];
    if (!arr) {
      arr = [[NSMutableArray alloc] init];
      self.typeToArray[type] = arr;
    }
    [arr addObject: @{
      @"type": type,
      @"content": content,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestType:(NSString*)type originalFileURL:(NSURL*) originalFileURL content:(NSString*)content {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray * arr = self.typeToArray[type];
    if (!arr) {
      arr = [[NSMutableArray alloc] init];
      self.typeToArray[type] = arr;
    }
    [arr addObject: @{
      @"type": type,
      @"originalPath":[originalFileURL absoluteURL].path,
      @"content": content,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestType:(NSString*)type originalFileURL:(NSURL*) originalFileURL scaledFileURL:(NSURL*)scaledFileURL thumbnailFileURL:(NSURL*)thumbnailFileURL {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray * arr = self.typeToArray[type];
    if (!arr) {
      arr = [[NSMutableArray alloc] init];
      self.typeToArray[type] = arr;
    }
    [arr addObject: @{
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
    NSString * type = @"error";
    NSMutableArray * arr = self.typeToArray[type];
    if (!arr) {
      arr = [[NSMutableArray alloc] init];
      self.typeToArray[type] = arr;
    }
    [arr addObject:@{
      @"error": [NSString stringWithFormat:@"%@: %@", text, error != nil ? error : @"<empty>"],
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (NSArray *)manifest {
  // reconcile what we're sending over // types text, url, video, image, file, error
  NSLog(@"aaa writeManifest %@", self.typeToArray);
  
  NSMutableArray * toWrite = [[NSMutableArray alloc] init];
  NSArray * urls = self.typeToArray[@"url"];
 
  // We treat all text that has http in it a url, we take the longest one as its likely most descriptive
  if (urls) {
    NSString * content = urls.firstObject[@"content"];
    for (NSDictionary * url in urls) {
      NSString * c = url[@"content"];
      if (c.length > content.length) {
        content = c;
      }
    }
    [toWrite addObject:@{
      @"type": @"text",
      @"content": content,
    }];
  } else {
    NSArray * images = self.typeToArray[@"image"];
    NSArray * videos = self.typeToArray[@"video"];
    NSArray * files = self.typeToArray[@"file"];
    NSArray * texts = self.typeToArray[@"text"];
    // If we have media, ignore text, we want to attach stuff and not also inject into the input box
    if (images.count || videos.count || files.count) {
      [toWrite addObjectsFromArray: images];
      [toWrite addObjectsFromArray: videos];
      [toWrite addObjectsFromArray: files];
    } else if(texts.count) {
      // Likely just one piece of text
      [toWrite addObject:texts.firstObject];
    }
  }
  
  return toWrite;
}

- (void)writeManifest {
  NSArray * toWrite = self.manifest;
  NSLog(@"aaa output %@", toWrite);
  NSURL* fileURL = [self getManifestFileURL];
  // write even if empty so we don't keep old manifests around
  NSOutputStream * output = [NSOutputStream outputStreamWithURL:fileURL append:false];
  [output open];
  NSError * error;
  [NSJSONSerialization writeJSONObject:toWrite toStream:output options:0 error:&error];
}

NSInteger TEXT_LENGTH_THRESHOLD = 1000; // TODO make this match the actual limit in chat

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
  
  NSItemProviderCompletionHandler vcardHandler = ^(id<NSSecureCoding> item, NSError* error) {
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"vcardHandler: unable to decode share" error:error];
      return;
    }
    
    if ([(NSObject*)item isKindOfClass:[NSData class]]) {
      NSData *vCardData = (NSData *)item;
      NSError * err = nil;
      NSArray<CNContact *> * contacts = [CNContactVCardSerialization contactsWithData:vCardData error:&err];
      CNPostalAddressFormatter *addressFormatter = [[CNPostalAddressFormatter alloc] init];
      NSMutableArray * contents = [[NSMutableArray alloc] init];
      
      for (CNContact * contact in contacts) {
        NSLog(@"aaa %@", contact);
        NSMutableArray * content = [[NSMutableArray alloc] init];
        NSString *fullName = [CNContactFormatter stringFromContact:contact style:CNContactFormatterStyleFullName];
        if (fullName.length) {
          [content addObject:fullName];
        }
        if (contact.organizationName.length) {
          [content addObject:[NSString stringWithFormat:@"Organization: %@", contact.organizationName]];
        }
        for (CNLabeledValue<CNPhoneNumber *> *phoneNumber in contact.phoneNumbers) {
          NSString *label = [CNLabeledValue localizedStringForLabel:phoneNumber.label];
          NSString *number = [phoneNumber.value stringValue];
          
          if (label.length && number.length) {
            [content addObject: [NSString stringWithFormat:@"%@: %@", label, number]];
          } else if (number.length) {
            [content addObject: number];
          }
        }
        NSMutableArray * misc = [[NSMutableArray alloc] init];
        [misc addObjectsFromArray: contact.emailAddresses];
        [misc addObjectsFromArray: contact.urlAddresses];
        for (CNLabeledValue<NSString *> *m in misc) {
          NSString *label = [CNLabeledValue localizedStringForLabel:m.label];
          NSString *val = m.value;
          
          if (label.length && val.length) {
            [content addObject: [NSString stringWithFormat:@"%@: %@", label, val]];
          } else if (val.length) {
            [content addObject: val];
          }
        }
        
        for(CNLabeledValue<CNPostalAddress *> *postalAddress in contact.postalAddresses) {
          NSString *label = [CNLabeledValue localizedStringForLabel:postalAddress.label];
          NSString *val = [addressFormatter stringFromPostalAddress:postalAddress.value];
          if (label.length && val.length) {
            [content addObject: [NSString stringWithFormat:@"%@: %@", label, val]];
          } else if (val.length) {
            [content addObject: val];
          }
        }
        
        if (content.count) {
          [contents addObject:[content componentsJoinedByString:@"\n"]];
        }
      }
      if (contents.count) {
        NSString * text = [contents componentsJoinedByString:@"\n\n"];
        [self completeItemAndAppendManifestType: @"text" content:text];
      } else {
        [self completeItemAndAppendManifestAndLogErrorWithText:@"vcardHandler: unable to decode share" error:nil];
      }
    } else {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"vcardHandler: unable to decode share" error:nil];
    }
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
      
    BOOL isURL = [text rangeOfString:@"http" options:NSCaseInsensitiveSearch].location != NSNotFound;
    
    if (text.length < TEXT_LENGTH_THRESHOLD) {
      [self completeItemAndAppendManifestType: isURL ? @"url" : @"text" content:text];
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
  
  BOOL handled = NO;
  for (NSArray * items in self.itemArrs) {
    // only handle one from itemArrs
    if (handled) {
      break;
    }

    for (NSItemProvider * item in items) {  
      // debug temp
      for (NSString * s in types) {
        if ([item hasItemConformingToTypeIdentifier:s]) {
          NSLog(@"aaa hasconform %@", s);
        }
      }
      
      NSLog(@"aaa reg: %@", item.registeredTypeIdentifiers);
      for (NSString * stype in item.registeredTypeIdentifiers) {
        // Movies
        NSLog(@"aaa stype: %@", stype);
        if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeMovie)) {
          NSLog(@"aaa movie");
          self.unprocessed++;
          handled = YES;
          [item loadFileRepresentationForTypeIdentifier:stype completionHandler:fileHandlerSimple2];
          break;
          // Images
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypePNG) ||
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeGIF) ||
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeJPEG)
                   ) {
          NSLog(@"aaa image");
          handled = YES;
          self.unprocessed++;
          [item loadFileRepresentationForTypeIdentifier:stype completionHandler:fileHandlerSimple2];
          break;
          // HEIC Images
        } else if ([stype isEqual:@"public.heic"]) {
          NSLog(@"aaa heic");
          handled = YES;
          self.unprocessed++;
          [item loadFileRepresentationForTypeIdentifier:@"public.heic" completionHandler:fileHandlerSimple2];
          break;
          // Unknown images, coerced
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeImage)) {
          NSLog(@"aaa generic image?");
          self.unprocessed++;
          handled = YES;
          [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:coerceImageHandlerSimple2]; // ⚠️ coerce
          break;
          // Contact cards
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeVCard)) {
          NSLog(@"aaa vcard");
          handled = YES;
          self.unprocessed++;
          [item loadDataRepresentationForTypeIdentifier:@"public.vcard" completionHandler: vcardHandler];
          break;
          // Text
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypePlainText)) {
          NSLog(@"aaa plain text");
          handled = YES;
          self.unprocessed++;
          [item loadItemForTypeIdentifier:@"public.plain-text" options: nil completionHandler: coerceTextHandler2]; // ⚠️ coerce
          break;
          // local file urls
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeFileURL)) {
          handled = YES;
          self.unprocessed++;
          // this is a local url and not something to show to the user, instead we download it
          [item loadFileRepresentationForTypeIdentifier: @"public.item" completionHandler:fileHandlerSimple2];
          break;
          // web urls
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeURL)) {
          NSLog(@"aaa url");
          handled = YES;
          self.unprocessed++;
          [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:coerceTextHandler2]; // ⚠️ coerce
          break;
        }
      }
    }
  }
  
  self.unprocessed++;
  // in case we didn't find anything clean up
  dispatch_async(dispatch_get_main_queue(), ^{
    [self completeProcessingItemAlreadyInMainThread];
  });
}

@end
