//
//  KBInstallerView.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallerView.h"

#import "KBHeaderLabelView.h"
#import "KBInstallAction.h"
#import "KBInstaller.h"
#import "KBRunOver.h"

@interface KBInstallerView ()
@property YOView *installStatusView;
@property YOHBox *buttons;
@property YOHBox *skipButtons;
@end

@implementation KBInstallerView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  GHWeakSelf gself = self;

  YOVBox *contentView = [YOVBox box:@{@"spacing": @(20)}];
  [self addSubview:contentView];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Install Status" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [contentView addSubview:header];

  _installStatusView = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];
  [contentView addSubview:_installStatusView];

  _buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [contentView addSubview:_buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [_buttons addSubview:closeButton];
  KBButton *skipButton = [KBButton buttonWithText:@"Skip" style:KBButtonStyleDefault];
  skipButton.targetBlock = ^{ [gself skip]; };
  [_buttons addSubview:skipButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Continue" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{ [gself install]; };
  [_buttons addSubview:nextButton];  

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:contentView]];
}

- (void)install {

  // TODO Do we attempt re-install if install action has error?
  NSArray *installActions = [_installActions select:^BOOL(KBInstallAction *installAction) { return installAction.status != KBInstallStatusInstalled; }];

  if ([installActions count] == 0) {
    self.completion(nil);
    return;
  }

  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = installActions;
  rover.runBlock = ^(KBInstallAction *installAction, KBRunCompletion runCompletion) {
    [installAction.installable install:^(NSError *error, KBInstallStatus status, NSString *info) {
      if (error) {
        installAction.error = error;
        installAction.status = status;
        installAction.statusInfo = nil;
      } else {
        // Installed, lets refresh status
        [installAction.installable installStatus:^(NSError *error, KBInstallStatus status, NSString *info) {
          installAction.error = error;
          installAction.status = status;
          installAction.statusInfo = info;
        }];
      }

      [self setNeedsLayout];
      runCompletion(installAction);
    }];
  };
  rover.completion = ^(NSArray *installActions) {
    // TODO Handle errors in output, don't call completion on error
    [KBActivity setProgressEnabled:NO sender:self];

    //[self checkInstalls:installActions];
    [self setInstallActions:gself.installActions];
  };
  [rover run];
}

- (void)checkInstalls:(NSArray *)installs {
  for (KBInstallAction *install in installs) {
    if (install.error) {
      [self enableRetrySkip];
      return;
    }
  }
  self.completion(nil);
}

- (void)enableRetrySkip {
  _buttons.hidden = YES;
  _skipButtons.hidden = NO;
  [self setNeedsLayout];
}

- (void)retry {
  [self install];
}

- (void)skip {
  self.completion(nil);
}

- (void)viewDidAppear:(BOOL)animated {

}

- (void)setInstallActions:(NSArray *)installActions {
  _installActions = installActions;

  NSArray *installViews = [_installStatusView.subviews copy];
  for (NSView *subview in installViews) [subview removeFromSuperview];

  for (KBInstallAction *installAction in installActions) {
    NSString *name = installAction.installable.info;

    NSString *status = NSStringFromKBInstallStatus(installAction.status);
    if (installAction.statusInfo) {
      status = [status stringByAppendingString:NSStringWithFormat(@" (%@)", installAction.statusInfo)];
    }

    KBHeaderLabelView *label = [KBHeaderLabelView headerLabelViewWithHeader:name headerOptions:0 text:status style:KBTextStyleDefault options:0 lineBreakMode:NSLineBreakByCharWrapping];
    label.columnRatio = 0.5;
    [_installStatusView addSubview:label];
  }

  [_installStatusView setNeedsLayout];
  [self setNeedsLayout];
}


@end
