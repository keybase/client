//
//  KBCatalogView.m
//  Keybase
//
//  Created by Gabriel on 1/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBMockViews.h"
#import "AppDelegate.h"
#import "KBUserProfileView.h"
#import "KBWebView.h"
#import "KBPGPKeyGenView.h"
#import "KBProveView.h"
#import "KBStyleGuideView.h"
#import "KBTestClientView.h"
#import "KBKeySelectView.h"
#import "KBDeviceSetupView.h"
#import "KBRMockClient.h"
#import "KBAppKit.h"
#import "KBDevicePromptView.h"
#import "KBProgressView.h"

@interface KBMockViews ()
@property KBRMockClient *mockClient;
@property NSMutableArray *items;
@end

@implementation KBMockViews

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

  _mockClient = [[KBRMockClient alloc] init];

  YOVBox *contentView = [YOVBox box:@{@"spacing": @(4), @"insets": @(20)}];
  //YOVBox *contentView = [YOVBox box:@{@"spacing": @(4), @"insets": @[@(20), @(20), @(20), @(20)]}];
  [contentView addSubview:[KBLabel labelWithText:@"Style Guides" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Style Guide" targetBlock:^{ [self showStyleGuide]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Mocks" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBLabel labelWithText:@"These views use mock data!" style:KBLabelStyleDefault]];

  [contentView addSubview:[KBButton linkWithText:@"App" targetBlock:^{ [self showAppView]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Login" targetBlock:^{ [self showLogin]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Signup" targetBlock:^{ [self showSignup]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Setup" targetBlock:^{ [self showDeviceSetupView]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Prompt" targetBlock:^{ [self showDevicePrompt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Select GPG Key" targetBlock:^{ [self showSelectKey]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Progress" targetBlock:^{ [self showProgressView:1 error:NO]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Progress (error)" targetBlock:^{ [self showProgressView:0 error:YES]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Prove Instructions" targetBlock:^{ [self showProveInstructions]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Track" targetBlock:^{ [self showTrack]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Error Handling" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Error" targetBlock:^{ [self showError]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Fatal" targetBlock:^{ [self showFatalError]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Prompts" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Password (Input)" targetBlock:^{ [self prompt:@"password"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Input" targetBlock:^{ [self prompt:@"input"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Yes/No" targetBlock:^{ [self prompt:@"yes_no"]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [self setDocumentView:contentView];
}

- (void)showProgressView:(NSTimeInterval)delay error:(BOOL)error {
  KBProgressView *progressView = [[KBProgressView alloc] init];
  [progressView setProgressTitle:@"Working"];
  progressView.work = ^(KBCompletionBlock completion) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      completion(error ? KBMakeErrorWithRecovery(-1, @"Some error happened", @"Intelligentsia ennui squid put a bird on it mixtape next level. Paleo Neutra banh mi fingerstache, small batch stumptown skateboard mustache asymmetrical vegan. Quinoa mustache mixtape literally occupy mlkshk..") : nil);
    });
  };
  [progressView openAndDoIt:self];
}

- (void)showProve:(NSString *)type {
  KBProveView *view = [[KBProveView alloc] init];
  view.proveType = KBProveTypeForServiceName(type);
  [self openInWindow:view size:CGSizeMake(360, 420) title:@"Prove"];
}

- (NSWindow *)openInWindow:(KBContentView *)view size:(CGSize)size title:(NSString *)title {
  view.client = self.mockClient;
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:title];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:size retain:YES];
  window.styleMask = window.styleMask | NSResizableWindowMask;
  [window center];
  [window setFrameOrigin:self.window.frame.origin];
  [window makeKeyAndOrderFront:nil];
  return window;
}

- (void)prompt:(NSString *)type {
  if ([type isEqualTo:@"password"]) {
    [KBAlert promptForInputWithTitle:@"Your secret password" description:@"Williamsburg heirloom Carles. Meggings sriracha High Life keytar photo booth craft beer. Artisan keytar cliche, Pinterest mumblecore 8-bit hella kale chips" secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {

    }];
  } else if ([type isEqualTo:@"yes_no"]) {
    [KBAlert yesNoWithTitle:@"Are you a hipster?" description:@"Flexitarian biodiesel locavore fingerstache. Craft beer brunch fashion axe bicycle rights, plaid messenger bag?" yes:@"Beer Me" view:self completion:^{
      // Yes
    }];
  } else if ([type isEqualTo:@"input"]) {
    [KBAlert promptForInputWithTitle:@"What's my favorite color?" description:@"Cold-pressed aesthetic yr fap locavore American Apparel, bespoke fanny pack." secure:NO style:NSInformationalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *input) {

    }];
  }
}

- (void)showTrack {
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  userProfileView.popup = YES;
  NSWindow *window = [self openInWindow:userProfileView size:CGSizeMake(400, 400) title:@"Keybase"];
  [window setLevel:NSFloatingWindowLevel];

  KBRMockClient *mockClient = [[KBRMockClient alloc] init];
  KBRUser *user = [[KBRUser alloc] initWithDictionary:@{@"username": @"gabrielh"} error:nil];
  [userProfileView setUser:user editable:NO client:mockClient];
}

- (void)showSelectKey {
  id params = [KBRMockClient requestForMethod:@"keybase.1.gpgUi.selectKeyAndPushOption"];
  KBRSelectKeyAndPushOptionRequestParams *requestParams = [[KBRSelectKeyAndPushOptionRequestParams alloc] initWithParams:params];

  KBKeySelectView *selectView = [[KBKeySelectView alloc] init];
  [selectView.keysView setGPGKeys:requestParams.keys];
  __weak KBKeySelectView *gselectView = selectView;
  selectView.selectButton.targetBlock = ^{
    GHDebug(@"Selected key: %@", gselectView.keysView.selectedGPGKey.keyID);
  };
  GHWeakSelf gself = self;
  selectView.cancelButton.targetBlock = ^{ [[gself window] close]; };
  [self openInWindow:selectView size:CGSizeMake(600, 400) title:@"Select PGP Key"];
}

- (void)showStyleGuide {
  KBStyleGuideView *testView = [[KBStyleGuideView alloc] init];
  [self openInWindow:testView size:CGSizeMake(300, 400) title:@"Keybase"];
}

- (void)showProveInstructions {
  KBProveInstructionsView *instructionsView = [[KBProveInstructionsView alloc] init];
  KBRText *text = [[KBRText alloc] init];
  text.data = @"<p>Please <strong>publicly</strong> post the following to the internets, and name it <strong>hello.md</strong></p>";
  text.markup = 1;
  NSString *proofText = @"Seitan four dollar toast banh mi, ethical ugh umami artisan paleo brunch listicle synth try-hard pop-up. Next level mixtape selfies, freegan Schlitz bitters Echo Park semiotics. Gentrify sustainable farm-to-table, cliche crucifix biodiesel ennui taxidermy try-hard cold-pressed Brooklyn fixie narwhal Bushwick Pitchfork. Ugh Etsy chia 3 wolf moon, drinking vinegar street art yr stumptown cliche Thundercats Marfa umami beard shabby chic Portland. Skateboard Vice four dollar toast stumptown, salvia direct trade hoodie. Wes Anderson swag small batch vinyl, taxidermy biodiesel Shoreditch cray pickled kale chips typewriter deep v. Actually XOXO tousled, freegan Marfa squid trust fund cardigan irony.\n\nPaleo pork belly heirloom dreamcatcher gastropub tousled. Banjo bespoke try-hard, gentrify Pinterest pork belly Schlitz sartorial narwhal Odd Future biodiesel 8-bit before they sold out selvage. Brunch disrupt put a bird on it Neutra organic. Pickled dreamcatcher post-ironic sriracha, organic Austin Bushwick Odd Future Marfa. Narwhal heirloom Tumblr forage trust fund, roof party gentrify keffiyeh High Life synth kogi Banksy. Kitsch photo booth slow-carb pour-over Etsy, Intelligentsia raw denim lomo. Brooklyn PBR&B Kickstarter direct trade literally, jean shorts photo booth narwhal irony kogi.";
  [instructionsView setInstructions:text proofText:proofText];
  [self openInWindow:instructionsView size:CGSizeMake(360, 420) title:@"Keybase"];
}

- (void)showAppView {
  KBAppView *appView = [[KBAppView alloc] init];
  [appView openWindow];
  KBRMockClient *mockClient = [[KBRMockClient alloc] init];
  [appView connect:mockClient];
}

- (void)showLogin {
  KBLoginView *loginView = [[KBLoginView alloc] init];
  KBDevicePromptView *devicePromptView = [[KBDevicePromptView alloc] init];
//  mockClient.handler = ^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
//    [loginView.navigation pushView:devicePromptView animated:YES];
//    completion(nil, @{});
//  };
  devicePromptView.completion = ^(id sender, NSError *error, NSString *deviceName) {
//    KBRSelectSignerRequestParams *requestParams = [[KBRSelectSignerRequestParams alloc] initWithParams:[KBRMockClient requestForMethod:@"keybase.1.doctorUi.selectSigner"]];
//    [loginView selectSigner:requestParams completion:^(NSError *error, id result) {
//      [loginView.window close];
//    }];
  };
  [self openInWindow:loginView size:CGSizeMake(800, 600) title:@"Keybase"];
}

- (void)showSignup {
  KBSignupView *signUpView = [[KBSignupView alloc] init];
  KBRMockClient *mockClient = [[KBRMockClient alloc] init];
  mockClient.handler = ^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    [signUpView.window close];
  };
  signUpView.client = mockClient;
  [self openInWindow:signUpView size:CGSizeMake(800, 600) title:@"Keybase"];
}

- (void)showDeviceSetupView {
  NSArray *params = [KBRMockClient requestForMethod:@"keybase.1.doctorUi.selectSigner"];

  KBRSelectSignerRequestParams *requestParams = [[KBRSelectSignerRequestParams alloc] initWithParams:params];

  KBDeviceSetupView *deviceSetupView = [[KBDeviceSetupView alloc] init];
  [deviceSetupView setDevices:requestParams.devices hasPGP:requestParams.hasPGP];
  GHWeakSelf gself = self;
  deviceSetupView.cancelButton.targetBlock = ^{ [[gself window] close]; };
  [self openInWindow:deviceSetupView size:CGSizeMake(560, 420) title:@"Device Setup"];
}

- (void)showDevicePrompt {
  KBDevicePromptView *devicePromptView = [[KBDevicePromptView alloc] init];
  devicePromptView.completion = ^(id sender, NSError *error, NSString *deviceName) {
    [[sender window] close];
  };
  [self openInWindow:devicePromptView size:CGSizeMake(600, 400) title:@"Keybase"];
}

- (void)showError {
  NSError *error = KBMakeErrorWithRecovery(-1, @"This is the error message.", @"This is the recovery suggestion.");
  [AppDelegate setError:error sender:self];
}

- (void)showFatalError {
  NSError *error = KBMakeErrorWithRecovery(-1, @"This is the fatal error message.", @"This is the recovery suggestion.");
  [AppDelegate.sharedDelegate setFatalError:error];
}

@end
