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

- (NSItemProvider*)getFirstSendableAttachment:(NSArray*)attachments {
  NSItemProvider* item = nil;
  for (NSItemProvider* a in attachments) {
    if ([a hasItemConformingToTypeIdentifier:@"public.url"] && ![a hasItemConformingToTypeIdentifier:@"public.file-url"]) {
      item = a;
      break;
    }
  }
  if(!item) {
    for (NSItemProvider* a in attachments) {
      if ([a hasItemConformingToTypeIdentifier:@"public.image"]) {
        item = a;
        break;
      }
    }
  }
  if(!item) {
    item = attachments.firstObject;
  }
  return item;
}

- (void)didReceiveMemoryWarning {
    KeybaseForceGC();
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
  
  NSExtensionItem *input = self.extensionContext.inputItems.firstObject;
  NSItemProvider* item = [self getFirstSendableAttachment:[input attachments]];
  PushNotifier* pusher = [[PushNotifier alloc] init];
  
  NSItemProviderCompletionHandler urlHandler = ^(NSURL* url, NSError* error) {
    NSString* body = (self.contentText.length) ? [NSString stringWithFormat:@"%@ %@", self.contentText, url.absoluteString] : url.absoluteString;
    KeybaseExtensionPostURL(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, body, pusher, &error);
    [[NSOperationQueue mainQueue] addOperationWithBlock:^{
      [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
    }];
  };
  
  NSItemProviderCompletionHandler fileHandler = ^(NSURL* url, NSError* error) {
    NSString* filePath = [url relativePath];
    if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
      // Generate image preview here, since it runs out of memory easy in Go
      [self createImagePreview:url resultCb:^(int baseWidth, int baseHeight, int previewWidth, int previewHeight, NSData* preview) {
        NSError* error = NULL;
        KeybaseExtensionPostJPEG(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, self.contentText, filePath,
                                 baseWidth, baseHeight, previewWidth, previewHeight, preview, pusher, &error);
      }];
    } else {
      KeybaseExtensionPostFile(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, self.contentText, filePath, pusher, &error);
    }
    [[NSOperationQueue mainQueue] addOperationWithBlock:^{
      [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
    }];
  };
  
  if([item hasItemConformingToTypeIdentifier:@"public.url"]) {
    [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:urlHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.file-url"]) {
    [item loadItemForTypeIdentifier:@"public.file-url" options:nil completionHandler:fileHandler];
  } else if ([item hasItemConformingToTypeIdentifier:@"public.image"]) {
    [item loadItemForTypeIdentifier:@"public.image" options:nil completionHandler:fileHandler];
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
