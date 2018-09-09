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

@interface ShareViewController ()
@property NSDictionary* convTarget;
@end

@implementation ShareViewController

- (BOOL)isContentValid {
    // Do validation of contentText and/or NSExtensionContext attachments here
    return YES;
}

- (NSItemProvider*)satisfiesTypeIdentifierCond:(NSArray*)attachments cond:(BOOL (^)(NSItemProvider*))cond {
  for (NSItemProvider* a in attachments) {
    if (cond(a)) {
      return a;
    }
  }
  return nil;
}

- (NSItemProvider*)getFirstSendableAttachment {
  NSExtensionItem *input = self.extensionContext.inputItems.firstObject;
  NSArray* attachments = [input attachments];
  NSItemProvider* item = [self satisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
    return (BOOL)([a hasItemConformingToTypeIdentifier:@"public.url"] && ![a hasItemConformingToTypeIdentifier:@"public.file-url"]);
  }];
  if (!item) {
    item = [self satisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
      return (BOOL)([a hasItemConformingToTypeIdentifier:@"public.text"]);
    }];
  }
  if (!item) {
    item = [self satisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
      return (BOOL)([a hasItemConformingToTypeIdentifier:@"public.image"]);
    }];
  }
  if(!item) {
    item = attachments.firstObject;
  }
  return item;
}

- (UIView*)loadPreviewView {
  NSItemProvider* item = [self getFirstSendableAttachment];
  if ([item hasItemConformingToTypeIdentifier:@"public.url"]) {
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
    KeybaseExtensionForceGC();
    [super didReceiveMemoryWarning];
}

- (void)createImagePreview:(NSURL*)url resultCb:(void (^)(int,int,int,int,NSData*))resultCb  {
  UIImage* original = [UIImage imageWithData:[NSData dataWithContentsOfURL:url]];
  CFURLRef cfurl = CFBridgingRetain(url);
  CGImageSourceRef is = CGImageSourceCreateWithURL(cfurl, nil);
  NSDictionary* opts = [[NSDictionary alloc] initWithObjectsAndKeys:
                    (id)kCFBooleanTrue, (id)kCGImageSourceCreateThumbnailWithTransform,
                    (id)kCFBooleanTrue, (id)kCGImageSourceCreateThumbnailFromImageIfAbsent,
                    [NSNumber numberWithInt:640], (id)kCGImageSourceThumbnailMaxPixelSize,
                    nil];
  CGImageRef image = CGImageSourceCreateThumbnailAtIndex(is, 0, (CFDictionaryRef)opts);
  UIImage* scaled = [UIImage imageWithCGImage:image];
  CGImageRelease(image);
  CFRelease(cfurl);
  CFRelease(is);
  NSData* preview = UIImageJPEGRepresentation(scaled, 1.0);
  resultCb(original.size.width, original.size.height, scaled.size.width, scaled.size.height, preview);
}

- (void)didSelectPost {
  if (!self.convTarget) {
    [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
    return;
  }
  
  NSItemProvider* item = [self getFirstSendableAttachment];
  PushNotifier* pusher = [[PushNotifier alloc] init];
  
  NSItemProviderCompletionHandler urlHandler = ^(NSURL* url, NSError* error) {
    KeybaseExtensionPostText(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, self.contentText, pusher, &error);
    [[NSOperationQueue mainQueue] addOperationWithBlock:^{
      [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
    }];
  };
  
  NSItemProviderCompletionHandler textHandler = ^(NSString* text, NSError* error) {
    KeybaseExtensionPostText(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, text, pusher, &error);
    [[NSOperationQueue mainQueue] addOperationWithBlock:^{
      [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
    }];
  };
  
  NSItemProviderCompletionHandler fileHandler = ^(NSURL* url, NSError* error) {
    // Check for no URL
    if (url == nil) {
      return;
    }
    
    NSString* filePath = [url relativePath];
    if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
      // Generate image preview here, since it runs out of memory easy in Go
      [self createImagePreview:url resultCb:^(int baseWidth, int baseHeight, int previewWidth, int previewHeight, NSData* preview) {
        NSError* error = NULL;
        KeybaseExtensionPostJPEG(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, self.contentText, filePath,
                                 baseWidth, baseHeight, previewWidth, previewHeight, preview, pusher, &error);
      }];
    } else {
      NSError* error = NULL;
      KeybaseExtensionPostFile(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, self.contentText, filePath, pusher, &error);
    }
    [[NSOperationQueue mainQueue] addOperationWithBlock:^{
      [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
    }];
  };
  
  if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
    [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.movie"]) {
    [item loadItemForTypeIdentifier:@"public.movie" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.file-url"]) {
    [item loadItemForTypeIdentifier:@"public.file-url" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.text"]) {
    [item loadItemForTypeIdentifier:@"public.text" options:nil completionHandler:textHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.url"]) {
    [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:urlHandler];
  } else {
    [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
  }
}

- (NSArray *)configurationItems {
  SLComposeSheetConfigurationItem *item = [[SLComposeSheetConfigurationItem alloc] init];
  item.title = @"Share to...";
  if (self.convTarget) {
    item.value = self.convTarget[@"Name"];
  } else {
    item.value = @"Please choose";
  }
  item.tapHandler = ^{
    ConversationViewController *viewController = [[ConversationViewController alloc] initWithStyle:UITableViewStylePlain];
    viewController.delegate = self;
    [self pushConfigurationViewController:viewController];
  };
  return @[item];
}

- (void)convSelected:(NSDictionary *)conv {
  [self setConvTarget:conv];
  [self reloadConfigurationItems];
  [self popConfigurationViewController];
}

@end
