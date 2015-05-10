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

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Install Status" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self addSubview:header];

  _installStatusView = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];
  [self addSubview:_installStatusView];

  YOHBox *buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [self addSubview:buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [buttons addSubview:closeButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Continue" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{ [gself next]; };
  [buttons addSubview:nextButton];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_installStatusView top:@[header] bottom:@[buttons] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];
}

- (void)next {

  // TODO Do we attempt re-install if install action has error
  NSArray *installables = [_installActions map:^(KBInstallAction *installAction) { return !installAction.installed ? installAction.installable : nil; }];

  if ([installables count] == 0) {
    self.completion(nil);
    return;
  }

  // TODO Show progress view
  KBRunOver *rover = [[KBRunOver alloc] init];
  rover.objects = installables;
  rover.runBlock = ^(id<KBInstallable> installable, KBRunCompletion runCompletion) {
    [installable install:^(NSError *error, BOOL installed) {
      KBInstallAction *install = [[KBInstallAction alloc] init];
      install.installable = installable;
      install.error = error;
      install.installed = installed;
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

    NSString *info = installAction.installable.info;
    NSString *actionDescription;
    if (installAction.error) {
      // TODO Handle error better here
      actionDescription = NSStringWithFormat(@"Error: %@", installAction.error);
    } else {
      actionDescription = installAction.installed ? @"Installed" : @"Needs Install";
    }
    KBHeaderLabelView *label = [KBHeaderLabelView headerLabelViewWithHeader:info headerOptions:0 text:actionDescription style:KBTextStyleDefault options:0 lineBreakMode:NSLineBreakByCharWrapping];
    label.columnRatio = 0.5;
    [_installStatusView addSubview:label];
  }

  [_installStatusView setNeedsLayout];
  [self setNeedsLayout];
}


@end
