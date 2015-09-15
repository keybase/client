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

@property (nonatomic) KBEnvironment *environment;
@end

@implementation KBInstallerView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  GHWeakSelf gself = self;

  YOVBox *contentView = [YOVBox box:@{@"spacing": @(20)}];
  [self addSubview:contentView];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Keybase Status" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [contentView addSubview:header];

  KBLabel *infoLabel = [[KBLabel alloc] init];
  [infoLabel setText:@"We need to install, update or start some components." style:KBTextStyleDefault alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [contentView addSubview:infoLabel];

  _installStatusView = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];
  _installStatusView.identifier = @"InstallStatus";
  [contentView addSubview:_installStatusView];

  _buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [contentView addSubview:_buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [NSApp terminate:0]; };
  [_buttons addSubview:closeButton];
  KBButton *skipButton = [KBButton buttonWithText:@"Skip" style:KBButtonStyleDefault];
  skipButton.targetBlock = ^{ [gself skip]; };
  [_buttons addSubview:skipButton];
  KBButton *refreshButton = [KBButton buttonWithText:@"Refresh" style:KBButtonStyleDefault];
  refreshButton.targetBlock = ^{ [gself refresh]; };
  [_buttons addSubview:refreshButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Update" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{ [gself install]; };
  [_buttons addSubview:nextButton];  

  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated {
  //
}

- (void)install {
  [KBActivity setProgressEnabled:YES sender:self];
  GHWeakSelf gself = self;
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:_environment completion:^(NSArray *installActions) {
    [KBActivity setProgressEnabled:NO sender:self];
    [self showInstallActions:gself.environment.installActions];
    if ([[gself.environment installActionsNeeded] count] == 0) {
      self.completion();
    }
  }];
}

- (void)refresh {
  [KBActivity setProgressEnabled:YES sender:self];
  GHWeakSelf gself = self;
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installStatusWithEnvironment:_environment completion:^(BOOL needsInstall) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (needsInstall) {
      [self showInstallActions:gself.environment.installActions];
    } else {
      self.completion();
    }
  }];
}

- (void)skip {
  self.completion();
}

- (void)setEnvironment:(KBEnvironment *)environment {
  _environment = environment;
  [self showInstallActions:[_environment installActions]];
}

- (void)showInstallActions:(NSArray *)installActions {
  NSArray *installViews = [_installStatusView.subviews copy];
  for (NSView *subview in installViews) [subview removeFromSuperview];

  for (KBInstallAction *installAction in installActions) {
    NSString *name = installAction.name;

    NSString *statusDescription = nil;
    if (installAction.installable.isInstallDisabled) {
      statusDescription = NSStringWithFormat(@"Install Disabled; %@", installAction.statusDescription);
    } else {
      statusDescription = installAction.statusDescription;
    }

    KBHeaderLabelView *label = [KBHeaderLabelView headerLabelViewWithHeader:name headerOptions:0 text:statusDescription style:KBTextStyleDefault options:0 lineBreakMode:NSLineBreakByWordWrapping];
    label.columnRatio = 0.5;
    [_installStatusView addSubview:label];
  }

  [_installStatusView setNeedsLayout];
  [self setNeedsLayout];
}

@end
