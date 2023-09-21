//
//  ShareViewController.m
//  KeybaseShare
//
//  Created by Michael Maxim on 8/31/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "ShareViewController.h"
#import "keybase/keybase.h"
#import <MobileCoreServices/MobileCoreServices.h>
#import "ItemProviderHelper.h"

#if TARGET_OS_SIMULATOR
const BOOL isSimulator = YES;
#else
const BOOL isSimulator = NO;
#endif


@interface ShareViewController ()
@property (nonatomic, strong) ItemProviderHelper * iph;
@property UIAlertController* alert;
@end

@implementation ShareViewController

//- (NSItemProvider*)firstSatisfiesTypeIdentifierCond:(NSArray*)attachments cond:(BOOL (^)(NSItemProvider*))cond {
//  for (NSItemProvider* a in attachments) {
//    if (cond(a)) {
//      return a;
//    }
//  }
//  return nil;
//}

//- (NSMutableArray*)allSatisfiesTypeIdentifierCond:(NSArray*)attachments cond:(BOOL (^)(NSItemProvider*))cond {
//  NSMutableArray* res = [NSMutableArray array];
//  for (NSItemProvider* a in attachments) {
//    if (cond(a)) {
//      [res addObject:a];
//    }
//  }
//  return res;
//}

//- (BOOL)isWebURL:(NSItemProvider*)item {
//  // "file URLs" also have type "url", but we want to treat them as files, not text.
//  return (BOOL)([item hasItemConformingToTypeIdentifier:@"public.url"] && ![item hasItemConformingToTypeIdentifier:@"public.file-url"]);
//}

// getSendableAttachments will get a list of messages we want to send from the share attempt. The flow is as follows:
// - If there is a URL item, we take it and only it.
// - If there is a text item, we take it and only it.
// - If there are none of the above, collect all the images and videos.
// - If we still don't have anything, select only the first item and hope for the best.
//- (NSArray*)getSendableAttachments {
//  NSExtensionItem *input = self.extensionContext.inputItems.firstObject;
//  NSArray* attachments = [input attachments];
//  return attachments;
//  NSMutableArray* res = [NSMutableArray array];
//  NSItemProvider* item = [self firstSatisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
//    return [self isWebURL:a];
//  }];
//  if (item) {
//    [res addObject:item];
//  }
//  if ([res count] == 0) {
//    item = [self firstSatisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
//      return (BOOL)([a hasItemConformingToTypeIdentifier:@"public.text"]);
//    }];
//    if (item) {
//      [res addObject:item];
//    }
//  }
//  if ([res count] == 0) {
//    res = [self allSatisfiesTypeIdentifierCond:attachments cond:^(NSItemProvider* a) {
//      return (BOOL)([a hasItemConformingToTypeIdentifier:@"public.image"] || [a hasItemConformingToTypeIdentifier:@"public.movie"]);
//    }];
//  }
//  if([res count] == 0 && attachments.firstObject != nil) {
//    [res addObject:attachments.firstObject];
//  }
//  return res;
//}

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

- (void) completeRequestAlreadyInMainThread {
  [self.alert dismissViewControllerAnimated:true completion:^{
    [self.extensionContext completeRequestReturningItems:nil completionHandler:^(BOOL expired) {
      [self openApp];
    }];
  }];
}

- (void)showProgressView {
  UIAlertController *alertController = [UIAlertController alertControllerWithTitle:@"Working on it"
                                                                        message:@"\n\nPreparing content for sharing into Keybase."
                                                                 preferredStyle:UIAlertControllerStyleAlert];

  self.alert = alertController;
  UIActivityIndicatorView *spinner = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
  [spinner startAnimating];
  spinner.translatesAutoresizingMaskIntoConstraints = NO;

  [alertController.view addSubview:spinner];

  [spinner.centerXAnchor constraintEqualToAnchor:alertController.view.centerXAnchor].active = YES;
  [spinner.centerYAnchor constraintEqualToAnchor:alertController.view.centerYAnchor constant:-8].active = YES;

  [self presentViewController:alertController animated:YES completion:nil];
}

- (void) closeProgressView {
  [self.alert dismissViewControllerAnimated:true completion:nil];
}

- (void) viewDidAppear:(BOOL)animated {
  [super viewDidAppear:animated];
  
  NSMutableArray *itemArrs = [NSMutableArray array];
//  NSArray *itemArrs = self.extensionContext.inputItems;
//  NSLog(@"aaa inputitems %@", self.extensionContext.inputItems);
//  NSArray* items = [input attachments];
//  NSString * sArrs = input.attributedContentText.string;
  NSMutableArray *sArrs = [NSMutableArray array];
  for (NSExtensionItem *inputItem in self.extensionContext.inputItems) {
    [itemArrs addObject:inputItem.attachments];
    NSString * str = inputItem.attributedContentText.string;
    if (str == nil) {
      str = @"";
    }
    [sArrs addObject: str];
  }
  
  __weak __typeof__(self) weakSelf = self;
  self.iph = [[ItemProviderHelper alloc] initForShare: true withItems:itemArrs attrStrings:sArrs completionHandler:^{
    __typeof__(self) strongSelf = weakSelf;
    if (strongSelf != nil) {
      [strongSelf completeRequestAlreadyInMainThread];
    }
  }];
  [self showProgressView];
  [self.iph startProcessing];
}

@end
