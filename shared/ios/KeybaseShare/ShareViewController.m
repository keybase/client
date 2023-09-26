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
  for (NSExtensionItem *inputItem in self.extensionContext.inputItems) {
    [itemArrs addObject:inputItem.attachments];
  }
  
  __weak __typeof__(self) weakSelf = self;
  self.iph = [[ItemProviderHelper alloc] initForShare: true withItems:itemArrs completionHandler:^{
    __typeof__(self) strongSelf = weakSelf;
    if (strongSelf != nil) {
      [strongSelf completeRequestAlreadyInMainThread];
    }
  }];
  [self showProgressView];
  [self.iph startProcessing];
}

@end
