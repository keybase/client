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

  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [contentView addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Continue" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{ [gself next]; };
  [buttons addSubview:nextButton];

  //self.viewLayout = [YOBorderLayout layoutWithCenter:_installStatusView top:@[header] bottom:@[buttons] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:contentView]];
}

- (void)next {

  // TODO Do we attempt re-install if install action has error?
  NSArray *installables = [_installActions select:^BOOL(KBInstallAction *installAction) { return installAction.status != KBInstallStatusInstalled; }];

  if ([installables count] == 0) {
    self.completion(nil);
    return;
  }

  // TODO Show progress view
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = installables;
  rover.runBlock = ^(id<KBInstallable> installable, KBRunCompletion runCompletion) {
    [installable install:^(NSError *error, KBInstallStatus status, NSString *info) {
      KBInstallAction *install = [[KBInstallAction alloc] init];
      install.installable = installable;
      install.error = error;
      install.status = status;
      runCompletion(install);
    }];
  };
  rover.completion = ^(NSArray *outputs) {
    // TODO Handle errors in output, don't call completion on error
    self.completion(nil);
  };
  [rover run];
}

- (void)viewDidAppear:(BOOL)animated {

}

- (void)setInstallActions:(NSArray *)installActions {
  _installActions = installActions;

  for (NSView *subview in _installStatusView.subviews) [subview removeFromSuperview];

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
