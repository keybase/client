//
//  ShareViewController.m
//  KeybaseShare
//
//  Created by Michael Maxim on 8/31/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "ShareViewController.h"
#import "keybase/keybase.h"
#import "Pusher.h"
#import "MediaUtils.h"
#import <MobileCoreServices/MobileCoreServices.h>
#import <AVFoundation/AVFoundation.h>
#import "Fs.h"

#if TARGET_OS_SIMULATOR
const BOOL isSimulator = YES;
#else
const BOOL isSimulator = NO;
#endif


@interface ShareViewController ()
@property NSMutableArray * manifest;
@property NSURL * payloadFolderURL;
@property UIAlertController* alert;
@property NSString* attributedContentText;
@property NSUInteger unprocessed;
@end

@implementation ShareViewController

- (NSItemProvider*)firstSatisfiesTypeIdentifierCond:(NSArray*)attachments cond:(BOOL (^)(NSItemProvider*))cond {
  for (NSItemProvider* a in attachments) {
    if (cond(a)) {
      return a;
    }
  }
  return nil;
}

- (NSMutableArray*)allSatisfiesTypeIdentifierCond:(NSArray*)attachments cond:(BOOL (^)(NSItemProvider*))cond {
  NSMutableArray* res = [NSMutableArray array];
  for (NSItemProvider* a in attachments) {
    if (cond(a)) {
      [res addObject:a];
    }
  }
  return res;
}

- (BOOL)isWebURL:(NSItemProvider*)item {
  // "file URLs" also have type "url", but we want to treat them as files, not text.
  return (BOOL)([item hasItemConformingToTypeIdentifier:@"public.url"] && ![item hasItemConformingToTypeIdentifier:@"public.file-url"]);
}

// getSendableAttachments will get a list of messages we want to send from the share attempt. The flow is as follows:
// - If there is a URL item, we take it and only it.
// - If there is a text item, we take it and only it.
// - If there are none of the above, collect all the images and videos.
// - If we still don't have anything, select only the first item and hope for the best.
- (NSArray*)getSendableAttachments {
  NSExtensionItem *input = self.extensionContext.inputItems.firstObject;
  self.attributedContentText = input.attributedContentText.string;
  NSArray* attachments = [input attachments];
  NSMutableArray* res = [NSMutableArray array];
  NSItemProvider* item = [self firstSatisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
    return [self isWebURL:a];
  }];
  if (item) {
    [res addObject:item];
  }
  if ([res count] == 0) {
    item = [self firstSatisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
      return (BOOL)([a hasItemConformingToTypeIdentifier:@"public.text"]);
    }];
    if (item) {
      [res addObject:item];
    }
  }
  if ([res count] == 0) {
    res = [self allSatisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
      return (BOOL)([a hasItemConformingToTypeIdentifier:@"public.image"] || [a hasItemConformingToTypeIdentifier:@"public.movie"]);
    }];
  }
  if([res count] == 0 && attachments.firstObject != nil) {
    [res addObject:attachments.firstObject];
  }
  return res;
}

- (void)didReceiveMemoryWarning {
  [super didReceiveMemoryWarning];
}

- (void) openApp {
  NSURL * url = [NSURL URLWithString:@"keybase://incoming-share"];
  UIResponder *responder = self;
  while (responder){
    if ([responder respondsToSelector: @selector(openURL:)]){
      [responder performSelector: @selector(openURL:) withObject: url];
      return;
    }
    responder =  [responder nextResponder];
  }
}

- (void) startProcessingAlreadyInMainThread:(NSInteger)items {
  self.unprocessed = items;
}

- (void) completeRequestAlreadyInMainThread {
  [self writeManifest];
  [self.alert dismissViewControllerAnimated:true completion:^{
    [self.extensionContext completeRequestReturningItems:nil completionHandler:^(BOOL expired) {
      [self openApp];
    }];
  }];
}

- (void) completeProcessingItemAlreadyInMainThread {
  if(--self.unprocessed > 0) { return; }
  [self completeRequestAlreadyInMainThread];
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

NSInteger TEXT_LENGTH_THRESHOLD = 512; // TODO make this match the actual limit in chat

- (void) handleText:(NSString *)text chatOnly:(BOOL)chatOnly loadError:(NSError *)error {
  if (chatOnly && text.length < TEXT_LENGTH_THRESHOLD) {
    [self completeItemAndAppendManifestType:@"text" content:text];
    return;
  } // If length is too large, just ignore the chatOnly flag.
  
  // We write the text into a file regardless because this could go to KBFS.
  // But if the text is short enough, we also include it in the manifest so
  // GUI can easily pre-fill it into the chat compose box.
  if (error != nil) {
    [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: load error" error:error];
    return;
  }
  NSURL * originalFileURL = [self getPayloadURLFromExt:@"txt"];
  [text writeToURL:originalFileURL atomically:true encoding:NSUTF8StringEncoding error:&error];
  if (error != nil){
    [self completeItemAndAppendManifestAndLogErrorWithText:@"handleText: unable to write payload file" error:error];
    return;
  }
  if (text.length < TEXT_LENGTH_THRESHOLD) {
    [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL content:text];
  } else {
    [self completeItemAndAppendManifestType:@"text" originalFileURL:originalFileURL];
  }
}

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

// processItem will invokve the correct function on the Go side for the given attachment type.
- (void)processItem:(NSItemProvider*)item {
  
  NSItemProviderCompletionHandler urlHandler = ^(NSURL* url, NSError* error) {
    if (self.attributedContentText != nil){
      [self handleText: [NSString stringWithFormat:@"%@ %@", self.attributedContentText, url.absoluteString] chatOnly:true loadError:error];
    }else{
      [self handleText: url.absoluteString chatOnly:true loadError:error];
    }
  };
  
  NSItemProviderCompletionHandler dataHandler = ^(NSData* data, NSError* error) {
    NSURL* filePayloadURL = [self getPayloadURLFromExt:@"data"];
    BOOL OK = [data writeToURL:filePayloadURL atomically:true];
    if (!OK) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"dataHandler: unable to write payload file" error:nil];
      return;
    }
    [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
  };
  
  NSItemProviderCompletionHandler fileHandlerSimple = ^(NSURL* url, NSError* error) {
    if (error != nil) {
      if ([item hasItemConformingToTypeIdentifier:@"public.data"]) {
        [item loadItemForTypeIdentifier:@"public.data" options:nil completionHandler: dataHandler];
        return;
      }
      [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandlerSimple: no url or public.data" error:error];
      return;
    }
    NSURL * filePayloadURL = [self getPayloadURLFromURL:url];
       [[NSFileManager defaultManager] copyItemAtURL:url toURL:filePayloadURL error:&error];
       if (error != nil) {
         [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandlerSimple: copy error" error:error];
         return;
    }
    [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
  };
  
  NSItemProviderCompletionHandler textHandler = ^(NSString* text, NSError* error) {
    if (error != nil) {
      if ([item hasItemConformingToTypeIdentifier:@"public.data"]) {
        [item loadItemForTypeIdentifier:@"public.data" options:nil completionHandler: fileHandlerSimple];
        return;
      }
      [self completeItemAndAppendManifestAndLogErrorWithText:@"textHandler: error and no public.data" error:nil];
    }
    [self handleText:text chatOnly:false loadError:error];
  };
  
  NSItemProviderCompletionHandler imageHandler = ^(UIImage* image, NSError* error) {
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"imageHandler: load error" error:error];
      return;
    }
    NSData * imageData = UIImageJPEGRepresentation(image, .85);
    NSURL * originalFileURL = [self getPayloadURLFromExt:@"jpg"];
    BOOL OK = [imageData writeToURL:originalFileURL atomically:true];
    if (!OK){
      [self completeItemAndAppendManifestAndLogErrorWithText:@"handleData: unable to write payload file" error:nil];
      return;
    }
    [self handleAndCompleteMediaFile:originalFileURL isVideo:false ];
  };
  
  // The NSItemProviderCompletionHandler interface is a little tricky. The caller of our handler
  // will inspect the arguments that we have given, and will attempt to give us the attachment
  // in this form. For files, we always want a file URL, and so that is what we pass in.
  NSItemProviderCompletionHandler fileHandlerMedia = ^(NSURL* url, NSError* error) {
    BOOL hasImage = [item hasItemConformingToTypeIdentifier:@"public.image"];
    BOOL hasVideo = [item hasItemConformingToTypeIdentifier:@"public.movie"];
    
    // We use the fileHandler for images because it might have not been possible for the OS to give us a URL. But if not, go through the regular imageHandler.
    if (error != nil) {
      if (hasImage) {
        // Try to handle with our imageHandler function
        [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:imageHandler];
        return;
      }
      [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandler: no url or public.image" error:error];
      return;
    }
    
    NSURL * filePayloadURL = [self getPayloadURLFromURL:url];
    [[NSFileManager defaultManager] copyItemAtURL:url toURL:filePayloadURL error:&error];
    if (error != nil) {
      [self completeItemAndAppendManifestAndLogErrorWithText:@"fileHandler: copy error" error:error];
      return;
    }
    
    if (hasVideo) {
      [self handleAndCompleteMediaFile:filePayloadURL isVideo:true];
    } else if (hasImage) {
      [self handleAndCompleteMediaFile:filePayloadURL isVideo:false];
    } else {
      [self completeItemAndAppendManifestType: @"file" originalFileURL:filePayloadURL];
    }
  };
  
  if ([item hasItemConformingToTypeIdentifier:@"public.movie"]) {
    [item loadItemForTypeIdentifier:@"public.movie" options:nil completionHandler:fileHandlerMedia];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
    // Use the fileHandler here, so if the image is from e.g. the Photos app,
    // we'd go with the copy routine instead of having to encode an NSImage.
    // This is important for staying under the mem limit.
    [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:fileHandlerMedia];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.file-url"]) {
    // Although this will be covered in the catch-all below, do it before public.text and public.url so that we get the file instead of a web URL when user shares a downloaded file from safari.
    [item loadItemForTypeIdentifier:@"public.file-url" options:nil completionHandler:fileHandlerSimple];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.text"]) {
    [item loadItemForTypeIdentifier:@"public.text" options:nil completionHandler:textHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.url"]) {
    [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:urlHandler];
  } else {
    // catch-all, including file-url or stuff like pdf from safari, or contact card.
    [item loadItemForTypeIdentifier:@"public.item" options:nil completionHandler: fileHandlerSimple];
  }
}

- (void)showProgressView {
  self.alert = [UIAlertController
                alertControllerWithTitle:@"Working on it"
                message:@"Preparing content for sharing into Keybase."
                preferredStyle:UIAlertControllerStyleAlert];
  UIActivityIndicatorView* spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleGray];
  [spinner setTranslatesAutoresizingMaskIntoConstraints:NO];
  [self.alert.view addConstraints:@[
    [NSLayoutConstraint constraintWithItem:spinner
                                 attribute:NSLayoutAttributeCenterX
                                 relatedBy:NSLayoutRelationEqual
                                    toItem:self.alert.view
                                 attribute:NSLayoutAttributeCenterX
                                multiplier:1 constant:0],
    [NSLayoutConstraint constraintWithItem:spinner
                                 attribute:NSLayoutAttributeCenterY
                                 relatedBy:NSLayoutRelationEqual
                                    toItem:self.alert.view
                                 attribute:NSLayoutAttributeCenterY
                                multiplier:1 constant:40],
    [NSLayoutConstraint constraintWithItem:self.alert.view
                                 attribute:NSLayoutAttributeBottom
                                 relatedBy:NSLayoutRelationEqual
                                    toItem:spinner
                                 attribute:NSLayoutAttributeBottom
                                multiplier:1 constant:10]
  ]
   ];
  
  [self.alert.view addSubview:spinner];
  [spinner startAnimating];
  [self presentViewController:self.alert animated:YES completion:nil];
}

- (void) closeProgressView {
  [self.alert dismissViewControllerAnimated:true completion:nil];
}

- (void)ensureManifestAndPayloadFolder {
  if (self.manifest == nil ) {
    self.manifest = [[NSMutableArray alloc] init];
  }
  [self.manifest removeAllObjects];
  self.payloadFolderURL = [self makePayloadFolder];
}

- (void)viewDidLoad {
  NSArray* items = [self getSendableAttachments];
  if ([items count] == 0) {
    [self completeRequestAlreadyInMainThread];
    return;
  }
  [self startProcessingAlreadyInMainThread:[items count]];
  [self showProgressView];
  [self ensureManifestAndPayloadFolder];
  for (int i = 0; i < [items count]; i++) {
    [self processItem:items[i]];
  }
}

@end
