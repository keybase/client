//
//  KBInstallStatusAppView.m
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBInstallStatusAppView.h"

#import "KBHeaderLabelView.h"
#import "KBInstaller.h"
#import "KBApp.h"

@implementation KBInstallStatusAppView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  GHWeakSelf gself = self;

  KBButton *closeButton = [KBButton buttonWithText:@"Quit" style:KBButtonStyleDefault];
  closeButton.targetBlock = ^{ self.onSelect(KBInstallStatusSelectQuit); };
  KBButton *skipButton = [KBButton buttonWithText:@"Skip" style:KBButtonStyleDefault];
  skipButton.targetBlock = ^{ self.onSelect(KBInstallStatusSelectSkip); };
  //      KBButton *refreshButton = [KBButton buttonWithText:@"Refresh" style:KBButtonStyleDefault];
  //      refreshButton.targetBlock = ^{ self.onSelect(KBInstallStatusSelectRefresh); };
  KBButton *nextButton = [KBButton buttonWithText:@"Re-Install" style:KBButtonStylePrimary];
  nextButton.targetBlock = ^{ self.onSelect(KBInstallStatusSelectReinstall); };

  [self setButtons:@[closeButton, skipButton, nextButton]];

  self.onSelect = ^(KBInstallStatusSelect select) {
    switch (select) {
      case KBInstallStatusSelectQuit: [gself.window close]; break; // TODO: Only close window?
      case KBInstallStatusSelectSkip: [gself skip]; break;
      case KBInstallStatusSelectControlPanel: [gself controlPanel]; break;
      case KBInstallStatusSelectRefresh: [gself refresh]; break;
      case KBInstallStatusSelectReinstall: [gself install]; break;
    }
  };
}

- (void)skip {
  self.completion();
}

- (void)controlPanel {
  [KBApp.app openControlPanel];
}

@end
