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
@property NSDictionary* convTarget; // the conversation we will be sharing into
@property NSDictionary* folderTarget; // the folder we will be sharing into
@property BOOL hasInited; // whether or not init has succeeded yet
@end

@implementation ShareViewController

- (BOOL)isContentValid {
    return self.hasInited && (self.convTarget != nil || self.folderTarget != nil);
}

// presentationAnimationDidFinish is called after the screen has rendered, and is the recommended place for loading data.
- (void)presentationAnimationDidFinish {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    BOOL skipLogFile = NO;
    NSError* error = nil;
    NSDictionary* fsPaths = [[FsHelper alloc] setupFs:skipLogFile setupSharedHome:NO];
    PushNotifier* pusher = [[PushNotifier alloc] init];
    KeybaseExtensionInit(fsPaths[@"home"], fsPaths[@"sharedHome"], fsPaths[@"logFile"], @"prod", isSimulator, pusher, &error);
    if (error != nil) {
      dispatch_async(dispatch_get_main_queue(), ^{
        // If Init failed, then let's throw up our error screen.
        NSLog(@"Failed to init: %@", error);
        InitFailedViewController* initFailed = [InitFailedViewController alloc];
        [initFailed setDelegate:self];
        [self pushConfigurationViewController:initFailed];
      });
      return;
    }
    [self setHasInited:YES]; // Init is complete, we can use this to take down spinner on convo choice row
   
    NSString* jsonSavedConv = KeybaseExtensionGetSavedConv(); // result is in JSON format
    if ([jsonSavedConv length] > 0) {
      NSData* data = [jsonSavedConv dataUsingEncoding:NSUTF8StringEncoding];
      NSDictionary* conv = [NSJSONSerialization JSONObjectWithData:data options: NSJSONReadingMutableContainers error: &error];
      if (!conv) {
        NSLog(@"failed to parse saved conv: %@", error);
      } else {
        // Success reading a saved convo, set it and reload the items to it.
        [self setConvTarget:conv];
      }
    }
    dispatch_async(dispatch_get_main_queue(), ^{
      [self validateContent];
      [self reloadConfigurationItems];
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

- (void)createVideoPreview:(NSURL*)url resultCb:(void (^)(int,int,int,int,int,NSString*,NSData*))resultCb  {
  NSError *error = NULL;
  NSString* path = [url relativePath];
  NSString* mimeType = KeybaseExtensionDetectMIMEType(path, &error);
  if (error != nil) {
    NSLog(@"MIME type error, setting to Quicktime: %@", error);
    mimeType = @"video/quicktime";
  }
  CMTime time = CMTimeMake(1, 1);
  AVURLAsset *asset = [[AVURLAsset alloc] initWithURL:url options:nil];
  AVAssetImageGenerator *generateImg = [[AVAssetImageGenerator alloc] initWithAsset:asset];
  [generateImg setAppliesPreferredTrackTransform:YES];
  CGImageRef cgOriginal = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];
  [generateImg setMaximumSize:CGSizeMake(640, 640)];
  CGImageRef cgThumb = [generateImg copyCGImageAtTime:time actualTime:NULL error:&error];
  int duration = CMTimeGetSeconds([asset duration]);
  UIImage* original = [UIImage imageWithCGImage:cgOriginal];
  UIImage* scaled = [UIImage imageWithCGImage:cgThumb];
  NSData* preview = UIImageJPEGRepresentation(scaled, 0.7);
  resultCb(duration, original.size.width, original.size.height, scaled.size.width, scaled.size.height, mimeType, preview);
  CGImageRelease(cgOriginal);
  CGImageRelease(cgThumb);
}

- (void)createImagePreview:(NSURL*)url resultCb:(void (^)(int,int,int,int,NSString*,NSData*))resultCb  {
  NSError* error = nil;
  NSString* path = [url relativePath];
  NSData* imageDat = [NSData dataWithContentsOfURL:url];
  NSString* mimeType = KeybaseExtensionDetectMIMEType(path, &error);
  if (error != nil) {
    NSLog(@"createImagePreview: MIME type error, setting to JPEG: %@", error);
    mimeType = @"image/jpeg";
  }
  // If this GIF is small enough, then we can probably create the real preview in
  // Go, so let's give it a shot.
  if ([mimeType isEqualToString:@"image/gif"] && imageDat.length < 10*1024*1024) {
    NSLog(@"createImagePreview: not generating preview for small GIF");
    resultCb(0, 0, 0, 0, mimeType, nil);
    return;
  }
  
  UIImage* original = [UIImage imageWithData:imageDat];
  CFURLRef cfurl = CFBridgingRetain(url);
  CGImageSourceRef is = CGImageSourceCreateWithURL(cfurl, nil);
  NSDictionary* opts = [[NSDictionary alloc] initWithObjectsAndKeys:
                        (id)kCFBooleanTrue, (id)kCGImageSourceCreateThumbnailWithTransform,
                        (id)kCFBooleanTrue, (id)kCGImageSourceCreateThumbnailFromImageAlways,
                        [NSNumber numberWithInt:640], (id)kCGImageSourceThumbnailMaxPixelSize,
                        nil];
  CGImageRef image = CGImageSourceCreateThumbnailAtIndex(is, 0, (CFDictionaryRef)opts);
  UIImage* scaled = [UIImage imageWithCGImage:image];
  NSData* preview = nil;
  if ([mimeType isEqualToString:@"image/png"]) {
    preview = UIImagePNGRepresentation(scaled);
  } else if ([mimeType isEqualToString:@"image/gif"]) {
    // We aren't going to be playing this in the thread, so let's just
    // use a JPEG
    preview = UIImageJPEGRepresentation(scaled, 0.7);
  } else {
    preview = UIImageJPEGRepresentation(scaled, 0.7);
  }
  resultCb(original.size.width, original.size.height, scaled.size.width, scaled.size.height, mimeType, preview);
  CGImageRelease(image);
  CFRelease(cfurl);
  CFRelease(is);
}

- (void) maybeCompleteRequest:(BOOL)lastItem {
  if (!lastItem) { return; }
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
  });
}

// handleFileURL will take a given file URL and run it through the proper backend
// function to send the contents at that URL. 
- (void)handleFileURL:(NSURL*)url item:(NSItemProvider*)item lastItem:(BOOL)lastItem {
  NSError* error;
  NSString* convID = self.convTarget[@"ConvID"];
  NSString* name = self.convTarget[@"Name"];
  NSNumber* membersType = self.convTarget[@"MembersType"];
  NSString* filePath = [url relativePath];
  
  if ([item hasItemConformingToTypeIdentifier:@"public.movie"]) {
    // Generate image preview here, since it runs out of memory easy in Go
    [self createVideoPreview:url resultCb:^(int duration, int baseWidth, int baseHeight, int previewWidth, int previewHeight,
                                            NSString* mimeType, NSData* preview) {
      NSError* error = NULL;
      KeybaseExtensionPostVideo(convID, name, NO, [membersType longValue], self.contentText, filePath, mimeType,
                                duration, baseWidth, baseHeight, previewWidth, previewHeight, preview, &error);
    }];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
    // Generate image preview here, since it runs out of memory easy in Go
    [self createImagePreview:url resultCb:^(int baseWidth, int baseHeight, int previewWidth, int previewHeight,
                                            NSString* mimeType, NSData* preview) {
      NSError* error = NULL;
      KeybaseExtensionPostImage(convID, name, NO, [membersType longValue], self.contentText, filePath, mimeType,
                                baseWidth, baseHeight, previewWidth, previewHeight, preview, &error);
    }];
  } else {
    NSError* error = NULL;
    KeybaseExtensionPostFile(convID, name, NO, [membersType longValue], self.contentText, filePath, &error);
  }
  [self maybeCompleteRequest:lastItem];
};

// processItem will invokve the correct function on the Go side for the given attachment type.
- (void)processItem:(NSItemProvider*)item lastItem:(BOOL)lastItem {
  NSString* convID = self.convTarget[@"ConvID"];
  NSString* name = self.convTarget[@"Name"];
  NSNumber* membersType = self.convTarget[@"MembersType"];
  NSItemProviderCompletionHandler urlHandler = ^(NSURL* url, NSError* error) {
    KeybaseExtensionPostText(convID, name, NO, [membersType longValue], self.contentText, &error);
    [self maybeCompleteRequest:lastItem];
  };
  
  NSItemProviderCompletionHandler textHandler = ^(NSString* text, NSError* error) {
    KeybaseExtensionPostText(convID, name, NO, [membersType longValue], text, &error);
    [self maybeCompleteRequest:lastItem];
  };
  
  // If we get an image in the form of a UIImage, we first write it to a temp file
  // and run it through the normal file sharing code path.
  NSItemProviderCompletionHandler imageHandler = ^(UIImage* image, NSError* error) {
    NSString* guid = [[NSProcessInfo processInfo] globallyUniqueString];
    NSString* filename = [NSString stringWithFormat:@"%@%@.jpg", NSTemporaryDirectory(), guid];
    NSURL* url = [NSURL fileURLWithPath:filename];
    
    NSData* imageData = UIImageJPEGRepresentation(image, 0.7);
    [imageData writeToFile:filename atomically:YES];
    [self handleFileURL:url item:item lastItem:lastItem];
    
    [[NSFileManager defaultManager] removeItemAtPath:filename error:&error];
    if (error != nil) {
      NSLog(@"unable to remove temp file: %@", error);
    }
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
    [self handleFileURL:url item:item lastItem:lastItem];
  };
  
  if ([item hasItemConformingToTypeIdentifier:@"public.movie"]) {
    [item loadItemForTypeIdentifier:@"public.movie" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
    [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.file-url"]) {
    [item loadItemForTypeIdentifier:@"public.file-url" options:nil completionHandler:fileHandler];
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
                              alertControllerWithTitle:@"Sending"
                              message:@"Encrypting and transmitting your message."
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

- (void)didSelectPost {
  if (!self.convTarget && !self.folderTarget) {
    // Just bail out of here if nothing was selected
    [self maybeCompleteRequest:YES];
    return;
  }
  NSArray* items = [self getSendableAttachments];
  if ([items count] == 0) {
    [self maybeCompleteRequest:YES];
    return;
  }
  [self showProgressView];
  for (int i = 0; i < [items count]; i++) {
    BOOL lastItem = (BOOL)(i == [items count]-1);
    [self processItem:items[i] lastItem:lastItem];
  }
}

- (NSArray *)configurationItems {
  // Share to chat
  SLComposeSheetConfigurationItem *chat = [[SLComposeSheetConfigurationItem alloc] init];
  chat.title = @"Share to chat...";
  chat.valuePending = !self.hasInited; // show a spinner if we haven't inited
  if (self.convTarget) {
    chat.value = self.convTarget[@"Name"];
  } else if (self.hasInited) {
    chat.value = @"Please choose";
  }
  chat.tapHandler = ^{
    ConversationViewController *viewController = [[ConversationViewController alloc] initWithStyle:UITableViewStylePlain];
    viewController.delegate = self;
    [self pushConfigurationViewController:viewController];
  };
  
  // Share to files
  SLComposeSheetConfigurationItem *files = [[SLComposeSheetConfigurationItem alloc] init];
  files.title = @"Share to files...";
  files.valuePending = !self.hasInited; // show a spinner if we haven't inited
  if (self.folderTarget) {
    files.value = self.folderTarget[@"Name"];
  } else if (self.hasInited) {
    files.value = @"Please choose";
  }
  files.tapHandler = ^{
    FilesViewController *viewController = [[FilesViewController alloc] initWithStyle:UITableViewStylePlain];
    viewController.delegate = self;
    [self pushConfigurationViewController:viewController];
  };

  return @[chat, files];
}

- (void)convSelected:(NSDictionary *)conv {
  // This is a delegate method from the inbox view, it gets run when the user taps an item.
  [self setConvTarget:conv];
  [self setFolderTarget:nil];
  [self validateContent];
  [self reloadConfigurationItems];
  [self popConfigurationViewController];
}

- (void)folderSelected:(NSDictionary *)folder {
  // This is a delegate method from the inbox view, it gets run when the user taps an item.
  [self setFolderTarget:folder];
  [self setConvTarget:nil];
  [self validateContent];
  [self reloadConfigurationItems];
  [self popConfigurationViewController];
}

@end
