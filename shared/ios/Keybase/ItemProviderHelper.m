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
#import <Contacts/CNContact.h>
#import <Contacts/CNContactFormatter.h>
#import <Contacts/CNContactVCardSerialization.h>
#import <Contacts/CNPostalAddressFormatter.h>
#import <MobileCoreServices/UTCoreTypes.h>
#import <MobileCoreServices/UTType.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@interface ItemProviderHelper ()
@property(nonatomic, strong) NSArray *itemArrs;
@property(nonatomic, strong) NSURL *payloadFolderURL;
@property BOOL isShare;
@property BOOL done;
@property(nonatomic, strong) NSMutableDictionary *typeToArray;
@property(nonatomic, copy) void (^completionHandler)(void);

// edited while processing
@property NSInteger unprocessed;
@end

@implementation ItemProviderHelper

- (void)completeProcessingItemAlreadyInMainThread {
  // more to process
  if (--self.unprocessed > 0) {
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
  NSURL *containerURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.keybase"];
  // Use the cache URL so if we fail to clean up payloads they can be deleted by
  // the OS.
  NSURL *cacheURL = [[containerURL URLByAppendingPathComponent:@"Library" isDirectory:true]
                     URLByAppendingPathComponent:@"Caches" isDirectory:true];
  NSURL *incomingShareFolderURL =
  [cacheURL URLByAppendingPathComponent:@"incoming-shares" isDirectory:true];
  return incomingShareFolderURL;
}

- (NSURL *)makePayloadFolder {
  NSURL *incomingShareFolderURL = [self getIncomingShareFolder];
  NSString *guid = [[NSProcessInfo processInfo] globallyUniqueString];
  NSURL *payloadFolderURL =
  [incomingShareFolderURL URLByAppendingPathComponent:guid isDirectory:true];
  [[NSFileManager defaultManager] createDirectoryAtURL:payloadFolderURL
                           withIntermediateDirectories:YES
                                            attributes:nil
                                                 error:nil];
  return payloadFolderURL;
}

- (id)initForShare:(BOOL)isShare withItems:(NSArray *)itemArrs completionHandler:(nonnull void (^)(void))handler {
  if (self = [super init]) {
    self.isShare = isShare;
    self.itemArrs = itemArrs;
    self.unprocessed = 0;
    self.completionHandler = handler;
    self.typeToArray = [[NSMutableDictionary alloc] init];
    self.payloadFolderURL = [self makePayloadFolder];
  }
  return self;
}

- (NSURL *)getPayloadURLFromURL:(NSURL *)fileUrl {
  NSString *guid = [[NSProcessInfo processInfo] globallyUniqueString];
  return fileUrl ? [self.payloadFolderURL URLByAppendingPathComponent:[fileUrl lastPathComponent]]
  : [self.payloadFolderURL URLByAppendingPathComponent:guid];
}

- (NSURL *)getPayloadURLFromExt:(NSString *)ext {
  NSString *guid = [[NSProcessInfo processInfo] globallyUniqueString];
  return ext ? [[self.payloadFolderURL URLByAppendingPathComponent:guid] URLByAppendingPathExtension:ext]
  : [self.payloadFolderURL URLByAppendingPathComponent:guid];
}

- (NSURL *)getManifestFileURL {
  NSURL *incomingShareFolderURL = [self getIncomingShareFolder];
  [[NSFileManager defaultManager] createDirectoryAtURL:incomingShareFolderURL
                           withIntermediateDirectories:YES
                                            attributes:nil
                                                 error:nil];
  return [incomingShareFolderURL URLByAppendingPathComponent:@"manifest.json"];
}

- (NSMutableArray *)ensureArrayOfType:(NSString *)type {
  NSMutableArray *arr = self.typeToArray[type];
  if (!arr) {
    arr = [[NSMutableArray alloc] init];
    self.typeToArray[type] = arr;
  }
  return arr;
}

- (void)completeItemAndAppendManifestType:(NSString *)type
                          originalFileURL:(NSURL *)originalFileURL {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray *arr = [self ensureArrayOfType:type];
    [arr addObject:@{
      @"type" : type,
      @"originalPath" : [originalFileURL absoluteURL].path,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

// No path; this is chatOnly.
- (void)completeItemAndAppendManifestType:(NSString *)type
                                  content:(NSString *)content {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray *arr = [self ensureArrayOfType:type];
    [arr addObject:@{
      @"type" : type,
      @"content" : content,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestType:(NSString *)type
                          originalFileURL:(NSURL *)originalFileURL
                                  content:(NSString *)content {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray *arr = [self ensureArrayOfType:type];
    [arr addObject:@{
      @"type" : type,
      @"originalPath" : [originalFileURL absoluteURL].path,
      @"content" : content,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestType:(NSString *)type
                          originalFileURL:(NSURL *)originalFileURL
                            scaledFileURL:(NSURL *)scaledFileURL {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray *arr = [self ensureArrayOfType:type];
    [arr addObject:@{
      @"type" : type,
      @"originalPath" : [originalFileURL absoluteURL].path,
      @"scaledPath" : [scaledFileURL absoluteURL].path,
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (void)completeItemAndAppendManifestAndLogErrorWithText:(NSString *)text
                                                   error:(NSError *)error {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMutableArray *arr = [self ensureArrayOfType:@"error"];
    [arr addObject:@{
      @"error" : [NSString
                  stringWithFormat:@"%@: %@", text, error != nil ? error : @"<empty>"],
    }];
    [self completeProcessingItemAlreadyInMainThread];
  });
}

- (NSArray *)manifest {
  // reconcile what we're sending over. types=text, url, video, image, file,
  // error
  NSMutableArray *toWrite = [[NSMutableArray alloc] init];
  NSArray *urls = self.typeToArray[@"url"];
  
  // We treat all text that has http in it a url, we take the longest one as its
  // likely most descriptive
  if (urls) {
    NSString *content = urls.firstObject[@"content"];
    for (NSDictionary *url in urls) {
      NSString *c = url[@"content"];
      if (c.length > content.length) {
        content = c;
      }
    }
    [toWrite addObject:@{
      @"type" : @"text",
      @"content" : content,
    }];
  } else {
    NSArray *images = self.typeToArray[@"image"];
    NSArray *videos = self.typeToArray[@"video"];
    NSArray *files = self.typeToArray[@"file"];
    NSArray *texts = self.typeToArray[@"text"];
    // If we have media, ignore text, we want to attach stuff and not also
    // inject into the input box
    if (images.count || videos.count || files.count) {
      [toWrite addObjectsFromArray:images];
      [toWrite addObjectsFromArray:videos];
      [toWrite addObjectsFromArray:files];
    } else if (texts.count) {
      // Likely just one piece of text
      [toWrite addObject:texts.firstObject];
    }
  }
  
  return toWrite;
}

- (void)writeManifest {
  NSArray *toWrite = self.manifest;
  NSURL *fileURL = [self getManifestFileURL];
  // write even if empty so we don't keep old manifests around
  NSOutputStream *output = [NSOutputStream outputStreamWithURL:fileURL
                                                        append:false];
  [output open];
  NSError *error;
  [NSJSONSerialization writeJSONObject:toWrite
                              toStream:output
                               options:0
                                 error:&error];
}

- (void)handleAndCompleteMediaFile:(NSURL *)url isVideo:(BOOL)isVideo {
  ProcessMediaCompletion completion =
  ^(NSError *error, NSURL *scaled) {
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:
       @"handleAndCompleteMediaFile"
                                                       error:error];
      return;
    }
    [self completeItemAndAppendManifestType:isVideo ? @"video" : @"image"
                            originalFileURL:url
                              scaledFileURL:scaled];
  };
  if (isVideo) {
    [MediaUtils processVideoFromOriginal:url completion:completion];
  } else {
    [MediaUtils processImageFromOriginal:url completion:completion];
  }
}

/**
 How this works:
 On a share we get an array of inputItems. Each inputItem has a metadata string
 and an array of NSItemProviders. Depending on the sending app we can get one
 inputItem and then an array of itemProviders, or we can get many inputItems
 with many itemProviders etc The itemProviders give an ordered list of
 representations to use. The NSItemProvider API has a binary API and a coercing
 API We attempt to use the binary API to explicitly ask for certain data types
 (png, gif, plainTextutf8 etc). If we can't resolve that we go down into very
 generic types (image, text) which we have to use the (worse) coercing types to
 get the framework to peer into the data and do the right thing. This approach
 seems to give us the best chance to decode these attachments. It really varies
 wildly depending on the app and apple itself doesn't give you nice types on old
 apps (app store, etc). When coercing we usually want nscoding ids but often we
 get an inscrutible NSArchiving or Binary plist so instead we have to get the
 system to coerce it to NSURL/NSString
 
 
 */

- (void)sendText:(NSString *)text {
  if (text.length == 0) {
    [self completeItemAndAppendManifestAndLogErrorWithText:@"sendText: empty?" error:nil];
    return;
  }
  if (text.length < 1000) {
    BOOL isURL =
    [text rangeOfString:@"http" options:NSCaseInsensitiveSearch].location !=
    NSNotFound;
    [self completeItemAndAppendManifestType:isURL ? @"url" : @"text" content:text];
    return;
  }
  
  NSURL *originalFileURL = [self getPayloadURLFromExt:@"txt"];
  NSError *error;
  [text writeToURL:originalFileURL
        atomically:true
          encoding:NSUTF8StringEncoding
             error:&error];
  if (error != nil) {
    [self completeItemAndAppendManifestAndLogErrorWithText: @"sendText: unable to write payload file" error:error];
    return;
  }
  
  [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL];
}

- (void)sendFile:(NSURL *)url {
  if (!url) {
    [self completeItemAndAppendManifestAndLogErrorWithText: @"sendFile: unable to decode share" error:nil];
    return;
  }
  
  NSURL *filePayloadURL = [self getPayloadURLFromURL:url];
  NSError *error = nil;
  [[NSFileManager defaultManager] copyItemAtURL:url
                                          toURL:filePayloadURL
                                          error:&error];
  if (error != nil) {
    [self completeItemAndAppendManifestAndLogErrorWithText: @"fileHandlerSimple: copy error" error:error];
  } else {
    [self completeItemAndAppendManifestType:@"file" originalFileURL:filePayloadURL];
  }
}

- (void)sendContact:(NSData *)vCardData {
  NSError *err = nil;
  NSArray<CNContact *> *contacts =
  [CNContactVCardSerialization contactsWithData:vCardData error:&err];
  CNPostalAddressFormatter *addressFormatter =
  [[CNPostalAddressFormatter alloc] init];
  NSMutableArray *contents = [[NSMutableArray alloc] init];
  
  for (CNContact *contact in contacts) {
    NSMutableArray *content = [[NSMutableArray alloc] init];
    NSString *fullName =
    [CNContactFormatter stringFromContact:contact style:CNContactFormatterStyleFullName];
    if (fullName.length) {
      [content addObject:fullName];
    }
    if (contact.organizationName.length) {
      [content addObject:[NSString stringWithFormat:@"Organization: %@", contact.organizationName]];
    }
    for (CNLabeledValue<CNPhoneNumber *> *phoneNumber in contact.phoneNumbers) {
      NSString *label =
      [CNLabeledValue localizedStringForLabel:phoneNumber.label];
      NSString *number = [phoneNumber.value stringValue];
      
      if (label.length && number.length) {
        [content addObject:[NSString stringWithFormat:@"%@: %@", label, number]];
      } else if (number.length) {
        [content addObject:number];
      }
    }
    NSMutableArray *misc = [[NSMutableArray alloc] init];
    [misc addObjectsFromArray:contact.emailAddresses];
    [misc addObjectsFromArray:contact.urlAddresses];
    for (CNLabeledValue<NSString *> *m in misc) {
      NSString *label = [CNLabeledValue localizedStringForLabel:m.label];
      NSString *val = m.value;
      
      if (label.length && val.length) {
        [content addObject:[NSString stringWithFormat:@"%@: %@", label, val]];
      } else if (val.length) {
        [content addObject:val];
      }
    }
    
    for (CNLabeledValue<CNPostalAddress *> *postalAddress in contact
         .postalAddresses) {
           NSString *label =
           [CNLabeledValue localizedStringForLabel:postalAddress.label];
           NSString *val =
           [addressFormatter stringFromPostalAddress:postalAddress.value];
           if (label.length && val.length) {
             [content addObject:[NSString stringWithFormat:@"%@: %@", label, val]];
           } else if (val.length) {
             [content addObject:val];
           }
         }
    
    if (content.count) {
      [contents addObject:[content componentsJoinedByString:@"\n"]];
    }
  }
  if (contents.count) {
    NSString *text = [contents componentsJoinedByString:@"\n\n"];
    [self completeItemAndAppendManifestType:@"text" content:text];
  } else {
    [self completeItemAndAppendManifestAndLogErrorWithText: @"vcardHandler: unable to decode share" error:nil];
  }
}

- (void)sendMovie:(NSURL *)url {
  NSError *error = nil;
  NSURL *filePayloadURL = nil;
  if (url != nil) {
    filePayloadURL = [self getPayloadURLFromURL:url];
    [[NSFileManager defaultManager] copyItemAtURL:url
                                            toURL:filePayloadURL
                                            error:&error];
  }
  if (filePayloadURL && error == nil) {
    [self handleAndCompleteMediaFile:filePayloadURL isVideo:true];
  } else {
    [self completeItemAndAppendManifestAndLogErrorWithText: @"movieFileHandlerSimple2: copy error" error:error];
  }
}

- (void)sendImage:(NSData *)imgData {
  if (imgData) {
    NSURL *originalFileURL = [self getPayloadURLFromExt:@"jpg"];
    BOOL OK = [imgData writeToURL:originalFileURL atomically:true];
    if (OK) {
      [self handleAndCompleteMediaFile:originalFileURL isVideo:false];
      return;
    }
  }
  
  [self completeItemAndAppendManifestAndLogErrorWithText: @"coerceImageHandlerSimple2: unable to decode share" error:nil];
}

- (void)startProcessing {
  NSItemProviderCompletionHandler fileHandlerSimple2 =
  ^(id<NSSecureCoding> item, NSError *error) {
    NSURL *url = nil;
    NSObject *i = (NSObject *)item;
    if (!error && [i isKindOfClass:[NSURL class]]) {
      url = (NSURL *)i;
    }
    [self sendFile:url];
  };
  
  for (NSArray *items in self.itemArrs) {
    // only handle one from itemArrs
    if (self.unprocessed > 0) {
      break;
    }
    
    for (NSItemProvider *item in items) {
      for (NSString *stype in item.registeredTypeIdentifiers) {
        // Movies
        if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeMovie)) {
          self.unprocessed++;
          [item
           loadFileRepresentationForTypeIdentifier:stype
           completionHandler:^(id<NSSecureCoding> item, NSError *error) {
            NSObject *i = (NSObject *)item;
            if (!error &&
                [i isKindOfClass:[NSURL class]]) {
              [self sendMovie:(NSURL *)i];
            } else {
              [self sendMovie:nil];
            }
          }];
          break;
          // Images
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypePNG) ||
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeGIF) ||
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeJPEG)) {
          self.unprocessed++;
          [item loadFileRepresentationForTypeIdentifier:stype completionHandler:fileHandlerSimple2];
          break;
          // HEIC Images
        } else if ([stype isEqual:@"public.heic"]) {
          self.unprocessed++;
          [item loadFileRepresentationForTypeIdentifier:@"public.heic" completionHandler:fileHandlerSimple2];
          break;
          // Unknown images, ⚠️ coerce
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeImage)) {
          self.unprocessed++;
          [item
           loadItemForTypeIdentifier:@"public.image"
           options:nil
           completionHandler:^(id<NSSecureCoding> item, NSError *error) {
            NSData *imgData = nil;
            NSObject *i = (NSObject *)item;
            if (error == nil) {
              if ([i isKindOfClass:[NSURL class]]) {
                imgData = [NSData dataWithContentsOfURL:(NSURL *)i];
                if (imgData) {
                  UIImage *image = [UIImage imageWithData:imgData];
                  imgData = UIImageJPEGRepresentation(image, 0.85);
                }
              } else if ([i isKindOfClass:[UIImage class]]) {
                imgData =
                UIImageJPEGRepresentation((UIImage *)i, 0.85);
              }
            }
            [self sendImage:imgData];
          }];
          break;
          // Contact cards
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeVCard)) {
          self.unprocessed++;
          [item
           loadDataRepresentationForTypeIdentifier:@"public.vcard"
           completionHandler:^(id<NSSecureCoding> item, NSError *error) {
            if (error == nil) {
              NSObject *i = (NSObject *)item;
              if ([i isKindOfClass:[NSData class]]) {
                [self sendContact:(NSData *)i];
                return;
              }
              [self
               completeItemAndAppendManifestAndLogErrorWithText: @"vcardHandler: unable to decode share" error: nil];
            }
          }];
          break;
          // Text ⚠️ coerce
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype,
                                    kUTTypePlainText)) {
          // We run a coersed to NSString an a NSSecureCoding so we can handle
          // this better, sometimes we get an empty text otherwise sadly
          self.unprocessed++;
          [item loadItemForTypeIdentifier:@"public.plain-text" options:nil
                        completionHandler:^(NSString *text, NSError *error) {
            [self sendText:text];
          }];
          self.unprocessed++;
          [item loadItemForTypeIdentifier:@"public.plain-text" options:nil
                        completionHandler:^(id<NSSecureCoding> item,
                                            NSError *error) {
            NSString *text = nil;
            if (error == nil) {
              NSObject *i = (NSObject *)item;
              if ([i isKindOfClass:[NSString class]]) {
                text = (NSString *)i;
              } else if ([i isKindOfClass:[NSURL class]]) {
                NSURL *url = (NSURL *)i;
                text = url.absoluteString;
                // not a user url
                if ([text hasPrefix:@"file://"]) {
                  NSData *d = [NSData dataWithContentsOfURL:url];
                  text = [[NSString alloc]
                          initWithData:d
                          encoding:NSUTF8StringEncoding];
                }
              } else if ([i isKindOfClass:[NSData class]]) {
                NSData *d = (NSData *)i;
                text = [[NSString alloc]
                        initWithData:d
                        encoding:NSUTF8StringEncoding];
              }
            }
            [self sendText:text];
          }];
          break;
          // local file urls, basically unknown, or known data files
        } else if (
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypePDF) ||
                   UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeFileURL)) {
          self.unprocessed++;
          [item loadFileRepresentationForTypeIdentifier:@"public.item" completionHandler:fileHandlerSimple2];
          break;
          // web urls ⚠️ coerce
        } else if (UTTypeConformsTo((__bridge CFStringRef)stype, kUTTypeURL)) {
          self.unprocessed++;
          [item loadItemForTypeIdentifier:@"public.url"
                                  options:nil
                        completionHandler:^(NSURL *url, NSError *error) {
            NSString *text = url.absoluteString;
            [self sendText:text];
          }];
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

/**
 Useful flows to check:
 Popular apps just sharing a url/text: zillow, chrome, messaging/social apps etc
 Apple apps: app store, music, notes, reminders, safari, contacts, apple tv, photos, system screenshot
 Special cases:
 imessage: share sent heic, drag drop sent heic, drag and extract image
 safari: drag url, share with all options (pdf, webarchive, etc)
 photos: drag, drag multiple, share with all options, share multiple
 */
