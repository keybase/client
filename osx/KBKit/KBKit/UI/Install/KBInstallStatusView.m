//
//  KBInstallStatusView.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallStatusView.h"

#import "KBHeaderLabelView.h"
#import "KBInstallAction.h"
#import "KBInstaller.h"
#import "KBRunOver.h"
#import "KBApp.h"
#import "KBKeybaseLaunchd.h"

@interface KBInstallStatusView ()
@property KBLabel *infoLabel;
@property YOView *installStatusView;
@property YOHBox *buttons;
@property YOHBox *skipButtons;

@property (nonatomic) KBEnvironment *environment;
@end

@implementation KBInstallStatusView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  GHWeakSelf gself = self;

  YOVBox *contentView = [YOVBox box:@{@"spacing": @(20), @"insets": @(20)}];
  [self addSubview:contentView];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Keybase Status" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [contentView addSubview:header];

  _infoLabel = [[KBLabel alloc] init];
  [contentView addSubview:_infoLabel];

  _installStatusView = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];
  _installStatusView.identifier = @"InstallStatus";
  [contentView addSubview:_installStatusView];

  YOHBox *debugView = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [debugView addSubview:[KBButton buttonWithText:@"Open Control Panel" style:KBButtonStyleLink options:0 targetBlock:^{ [self controlPanel]; }]];
  [contentView addSubview:debugView];

  _buttons = [YOHBox box:@{@"horizontalAlignment": @"center", @"spacing": @(10)}];
  [contentView addSubview:_buttons];
  KBButton *closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ [self.window close]; };
  //  quitButton = ^{ [NSApp terminate:0]; };
  [_buttons addSubview:closeButton];
//  KBButton *skipButton = [KBButton buttonWithText:@"Skip" style:KBButtonStyleDefault];
//  skipButton.targetBlock = ^{ [gself skip]; };
//  [_buttons addSubview:skipButton];
  KBButton *refreshButton = [KBButton buttonWithText:@"Refresh" style:KBButtonStyleDefault];
  refreshButton.targetBlock = ^{ [gself refresh]; };
  [_buttons addSubview:refreshButton];
  KBButton *nextButton = [KBButton buttonWithText:@"Install" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{ [gself install]; };
  [_buttons addSubview:nextButton];  

  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated {
  //
}

- (void)controlPanel {
  [KBApp.app openControlPanel];
}

- (void)install {
  [KBActivity setProgressEnabled:YES sender:self];
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:_environment force:NO completion:^() {
    [KBActivity setProgressEnabled:NO sender:self];
    [self showInstallables];
  }];
}

- (void)refresh {
  [KBActivity setProgressEnabled:YES sender:self];
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer refreshStatusWithEnvironment:_environment completion:^() {
    [KBActivity setProgressEnabled:NO sender:self];
    [self showInstallables];
  }];
}

- (void)skip {
  self.completion();
}

- (void)setEnvironment:(KBEnvironment *)environment {
  _environment = environment;
  [self showInstallables];
}

- (NSArray *)statusDescription:(id<KBInstallable>)installable {
  NSMutableArray *status = [NSMutableArray array];
  if (installable.isInstallDisabled) {
    [status addObject:@"Install Disabled"];
  }
  if (installable.componentStatus.error) {
    [status addObject:NSStringWithFormat(@"Error: %@", installable.componentStatus.error.localizedDescription)];
  }
  [status gh_addObject:installable.componentStatus.statusDescription];
  return status;
}

- (NSString *)action:(id<KBInstallable>)installable {
  if (installable.isInstallDisabled) {
    return NSStringFromKBRInstallAction(KBRInstallActionNone);
  } else {
    return NSStringFromKBRInstallAction(installable.componentStatus.installAction);
  }
}

- (void)showInstallables {
  NSArray *installViews = [_installStatusView.subviews copy];
  for (NSView *subview in installViews) [subview removeFromSuperview];

  [_infoLabel setText:@"Here is the status of all the Keybase components." style:KBTextStyleDefault alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  for (id<KBInstallable> installable in _environment.installables) {
    NSString *name = installable.name;

    NSString *statusDescription = [[self statusDescription:installable] join:@"\n"];

    KBHeaderLabelView *label = [KBHeaderLabelView headerLabelViewWithHeader:name headerOptions:0 text:statusDescription style:KBTextStyleDefault options:0 lineBreakMode:NSLineBreakByWordWrapping];
    label.columnRatio = 0.5;

    NSString *action = [self action:installable];
    if (action) {
      [label addText:action style:KBTextStyleDefault options:KBTextOptionsStrong lineBreakMode:NSLineBreakByWordWrapping targetBlock:nil];
    }

    [_installStatusView addSubview:label];
  }

  [_installStatusView setNeedsLayout];
  [self setNeedsLayout];
}

@end
