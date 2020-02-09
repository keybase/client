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
#import <MobileCoreServices/MobileCoreServices.h>
#import <AVFoundation/AVFoundation.h>
#import "Fs.h"

#if TARGET_OS_SIMULATOR
const BOOL isSimulator = YES;
#else
const BOOL isSimulator = NO;
#endif


@interface ShareViewController ()
@property BOOL hasInited; // whether or not init has succeeded yet
@property NSMutableArray *  manifest;
@end

@implementation ShareViewController

- (BOOL)isContentValid {
  return self.hasInited;
}

// presentationAnimationDidFinish is called after the screen has rendered, and is the recommended place for loading data.
- (void)presentationAnimationDidFinish {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    [self setHasInited:YES]; // Init is complete, we can use this to take down spinner on convo choice row
   
    dispatch_async(dispatch_get_main_queue(), ^{
      [self validateContent];
    });
  });
}

-(void)initFailedClosed {
  // Just bail out of the extension if init failed
  [self cancel];
}

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

// loadPreviewView solves the problem of running out of memory when rendering the image previews on URLs. In some
// apps, loading URLs from them will crash our extension because of memory constraints. Instead of showing the image
// preview, just paste the text into the compose box. Otherwise, just do the normal thing.
- (UIView*)loadPreviewView {
  NSArray* items = [self getSendableAttachments];
  if ([items count] == 0) {
    return [super loadPreviewView];
  }
  NSItemProvider* item = items[0];
  if ([self isWebURL:item]) {
    [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:^(NSURL *url, NSError *error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [self.textView setText:[NSString stringWithFormat:@"%@\n%@", self.contentText, [url absoluteString]]];
      });
    }];
    return nil;
  }
  return [super loadPreviewView];
}

- (void)didReceiveMemoryWarning {
    KeybaseExtensionForceGC(); // run Go GC and hope for the best
    [super didReceiveMemoryWarning];
}

- (void) openApp {
  NSURL * url = [NSURL URLWithString:@"keybase://share"];
  UIResponder *responder = self;
  while (responder){
    if ([responder respondsToSelector: @selector(openURL:)]){
      [responder performSelector: @selector(openURL:) withObject: url];
      return;
    }
    responder =  [responder nextResponder];
  }
}

- (void) maybeCompleteRequest:(BOOL)lastItem {
  if (!lastItem) { return; }
  [self writeManifest];
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
    [self openApp];
  });
}

- (NSURL *)getIncomingShareFolder {
  NSURL* containerURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier: @"group.keybase"];
  // Use the cache URL so if we fail to clean up payloads they can be deleted by the OS.
  NSURL* cacheURL = [[containerURL URLByAppendingPathComponent:@"Library" isDirectory:true] URLByAppendingPathComponent:@"Caches" isDirectory:true];
  NSURL* incomingShareFolderURL = [cacheURL URLByAppendingPathComponent:@"incoming-shares" isDirectory:true];
  return incomingShareFolderURL;
}

- (NSURL*)generatePayloadFileURLWithExtension:(NSString *)ext {
  NSURL* incomingShareFolderURL = [self getIncomingShareFolder];
  [[NSFileManager defaultManager] createDirectoryAtURL:incomingShareFolderURL withIntermediateDirectories:YES attributes:nil error:nil];
  NSString* guid = [[NSProcessInfo processInfo] globallyUniqueString];
  return ext ? [[incomingShareFolderURL URLByAppendingPathComponent:guid] URLByAppendingPathExtension:ext] : [incomingShareFolderURL URLByAppendingPathComponent:guid];
}

- (NSURL*)getManifestFileURL {
  NSURL* incomingShareFolderURL = [self getIncomingShareFolder];
  [[NSFileManager defaultManager] createDirectoryAtURL:incomingShareFolderURL withIntermediateDirectories:YES attributes:nil error:nil];
  return [incomingShareFolderURL URLByAppendingPathComponent:@"manifest.json"];
}

- (void)appendManifestType:(NSString*)type payloadFileURL:(NSURL*) payloadFileURL filename:(NSString*)filename {
  [self.manifest addObject: @{
    @"type": type,
    @"payloadPath":[payloadFileURL absoluteURL].path,
    @"filename": filename,
  }];
}

- (NSError *)writeManifest {
  NSURL* fileURL = [self getManifestFileURL];
  NSOutputStream * output = [NSOutputStream outputStreamWithURL:fileURL append:false];
  [output open];
  NSError * error;
  [NSJSONSerialization writeJSONObject:self.manifest toStream:output options:0 error:&error];
  return error;
}

- (void) handleText:(NSString *)text loadError:(NSError *)error {
  if (error != nil) {
    NSLog(@"handleText: load error: %@", error);
    return;
  }
  NSURL * payloadFileURL = [self generatePayloadFileURLWithExtension:@"txt"];
  [text writeToURL:payloadFileURL atomically:true encoding:NSUTF8StringEncoding error:&error];
  if (error != nil){
    NSLog(@"handleText: unable to write payload file: %@", error);
    return;
  }
  [self appendManifestType:@"text" payloadFileURL:payloadFileURL filename:@""];
}

- (void) handleData:(NSData *)data type:(NSString *)type ext:(NSString *)ext {
  NSURL * payloadFileURL = [self generatePayloadFileURLWithExtension:ext];
  BOOL OK = [data writeToURL:payloadFileURL atomically:true];
  if (!OK){
    NSLog(@"handleData: unable to write payload file");
    return;
  }
  [self appendManifestType:type payloadFileURL:payloadFileURL filename:@""];
}

// processItem will invokve the correct function on the Go side for the given attachment type.
- (void)processItem:(NSItemProvider*)item lastItem:(BOOL)lastItem {
  NSItemProviderCompletionHandler urlHandler = ^(NSURL* url, NSError* error) {
    [self handleText:self.contentText loadError:error];
    [self maybeCompleteRequest:lastItem];
  };
  
  NSItemProviderCompletionHandler textHandler = ^(NSString* text, NSError* error) {
    [self handleText:text loadError:error];
    [self maybeCompleteRequest:lastItem];
  };
  
  NSItemProviderCompletionHandler imageHandler = ^(UIImage* image, NSError* error) {
    if (error != nil) {
      NSLog(@"imageHandler: load error: %@", error);
      [self maybeCompleteRequest:lastItem];
      return;
    }
    NSData * imageData = UIImagePNGRepresentation(image);
    [self handleData:imageData type:@"image" ext:@"png"];
    [self maybeCompleteRequest:lastItem];
  };
  
  // The NSItemProviderCompletionHandler interface is a little tricky. The caller of our handler
  // will inspect the arguments that we have given, and will attempt to give us the attachment
  // in this form. For files, we always want a file URL, and so that is what we pass in.
  NSItemProviderCompletionHandler fileHandler = ^(NSURL* url, NSError* error) {
    // Check for no URL (it might have not been possible for the OS to give us one)
    if (url == nil) {
      if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
        // Try to handle with our imageHandler function
        [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:imageHandler];
      } else {
        [self maybeCompleteRequest:lastItem];
      }
      return;
    }
    NSURL * filePayloadURL = [self generatePayloadFileURLWithExtension:nil];
    [[NSFileManager defaultManager] copyItemAtURL:url toURL:filePayloadURL error:&error];
    if (error != nil) {
      NSLog(@"fileHandler: copy error: %@", error);
      [self maybeCompleteRequest:lastItem];
      return;
    }
    [self appendManifestType:@"file" payloadFileURL:filePayloadURL filename:[url lastPathComponent]];
    [self maybeCompleteRequest:lastItem];
  };
  
  if ([item hasItemConformingToTypeIdentifier:@"public.movie"]) {
    [item loadItemForTypeIdentifier:@"public.movie" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
    [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:imageHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.file-url"]) {
    [item loadItemForTypeIdentifier:@"public.file-url" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.plain-text"]) {
    [self handleText:self.contentText loadError:nil];
    [self maybeCompleteRequest:lastItem];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.text"]) {
    [item loadItemForTypeIdentifier:@"public.text" options:nil completionHandler:textHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.url"]) {
    [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:urlHandler];
  } else {
    [[[PushNotifier alloc] init] localNotification:@"extension" msg:@"We failed to send your message. Please try from the Keybase app."
                                        badgeCount:-1 soundName:@"default" convID:@"" typ:@"chat.extension"];
    [self maybeCompleteRequest:lastItem];
  }
}

- (void)showProgressView {
  UIAlertController* alert = [UIAlertController
                              alertControllerWithTitle:@"Working on it"
                              message:@"Preparing content for sharing into Keybase."
                              preferredStyle:UIAlertControllerStyleAlert];
  UIActivityIndicatorView* spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleGray];
  [spinner setTranslatesAutoresizingMaskIntoConstraints:NO];
  [alert.view addConstraints:@[
       [NSLayoutConstraint constraintWithItem:spinner
                                    attribute:NSLayoutAttributeCenterX
                                    relatedBy:NSLayoutRelationEqual
                                       toItem:alert.view
                                    attribute:NSLayoutAttributeCenterX
                                   multiplier:1 constant:0],
       [NSLayoutConstraint constraintWithItem:spinner
                                    attribute:NSLayoutAttributeCenterY
                                    relatedBy:NSLayoutRelationEqual
                                       toItem:alert.view
                                    attribute:NSLayoutAttributeCenterY
                                   multiplier:1 constant:40],
       [NSLayoutConstraint constraintWithItem:alert.view
                                    attribute:NSLayoutAttributeBottom
                                    relatedBy:NSLayoutRelationEqual
                                       toItem:spinner
                                    attribute:NSLayoutAttributeBottom
                                   multiplier:1 constant:10]
       ]
   ];
  
  [alert.view addSubview:spinner];
  [spinner startAnimating];
  [self presentViewController:alert animated:YES completion:nil];
}

- (void)ensureManifest {
  if (self.manifest == nil ) {
    self.manifest = [[NSMutableArray alloc] init];
  }
  [self.manifest removeAllObjects];
}

- (void)didSelectPost {
  NSArray* items = [self getSendableAttachments];
  if ([items count] == 0) {
    [self maybeCompleteRequest:YES];
    return;
  }
  [self showProgressView];
  [self ensureManifest];
  for (int i = 0; i < [items count]; i++) {
    BOOL lastItem = (BOOL)(i == [items count]-1);
    [self processItem:items[i] lastItem:lastItem];
  }
}

@end
