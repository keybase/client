//
//  KBCatalogView.m
//  Keybase
//
//  Created by Gabriel on 1/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBCatalogView.h"
#import "AppDelegate.h"
#import "KBUserProfileView.h"
#import "KBWebView.h"
#import "KBKeyGenView.h"
#import "KBProveView.h"
#import "KBStyleGuideView.h"
#import "KBTestClientView.h"
#import "KBKeySelectView.h"
#import "KBDeviceSetupView.h"
#import "KBRMockClient.h"
#import "KBAppKit.h"
#import "KBDevicePromptView.h"

@interface KBCatalogView ()
@property NSMutableArray *items;
@end

@implementation KBCatalogView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

  YONSView *contentView = [[YONSView alloc] init];
  [contentView addSubview:[KBLabel labelWithText:@"Style Guides" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Style Guide" actionBlock:^(id sender) { [self showStyleGuide]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Mocks" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBLabel labelWithText:@"These views use mock data!" style:KBLabelStyleDefault]];
  [contentView addSubview:[KBButton linkWithText:@"Login" actionBlock:^(id sender) { [self showLogin]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Setup" actionBlock:^(id sender) { [self showDeviceSetupView]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Prompt" actionBlock:^(id sender) { [self showDevicePrompt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Select GPG Key" actionBlock:^(id sender) { [self showSelectKey]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Prove Instructions" actionBlock:^(id sender) { [self showProveInstructions]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Track (max)" actionBlock:^(id sender) { [self showTrackReplay:@"max"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Track (gbrl27)" actionBlock:^(id sender) { [self showTrackReplay:@"gbrl27"]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Error Handling" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Error" actionBlock:^(id sender) { [self showError]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Fatal" actionBlock:^(id sender) { [self showFatalError]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Prompts" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Password (Input)" actionBlock:^(id sender) { [self prompt:@"password"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Input" actionBlock:^(id sender) { [self prompt:@"input"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Yes/No" actionBlock:^(id sender) { [self prompt:@"yes_no"]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Testing" style:KBLabelStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Test RPC Client" actionBlock:^(id sender) { [self showTestClientView]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  contentView.viewLayout = [YOLayout vertical:contentView.subviews margin:UIEdgeInsetsMake(20, 20, 20, 20) padding:4];

  KBScrollView *scrollView = [[KBScrollView alloc] init];
  [scrollView setDocumentView:contentView];
  [self addSubview:scrollView];

  self.viewLayout = [YOLayout fill:scrollView];
}

- (void)showTestClientView {
  KBTestClientView *testClientView = [[KBTestClientView alloc] init];
  [self openInWindow:testClientView size:CGSizeMake(360, 420) title:@"Test Client"];
}

- (void)showKeyGen:(BOOL)animated {
  KBKeyGenView *keyGenView = [[KBKeyGenView alloc] init];
  [self openInWindow:keyGenView size:CGSizeMake(360, 420) title:@"Keygen"];
}

- (void)showProve:(NSString *)type {
  KBProveView *view = [[KBProveView alloc] init];
  view.proveType = KBProveTypeForServiceName(type);
  [self openInWindow:view size:CGSizeMake(360, 420) title:@"Prove"];
}

+ (NSWindow *)createWindow {
  KBCatalogView *catalogView = [[KBCatalogView alloc] init];
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:catalogView title:@"Debug"];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(400, 400) retain:YES];
  window.styleMask = window.styleMask | NSResizableWindowMask;
  [window center];
  return window;
}

- (NSWindow *)openInWindow:(NSView *)view size:(CGSize)size title:(NSString *)title {
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
    [KBAlert promptWithTitle:@"Are you a hipster?" description:@"Flexitarian biodiesel locavore fingerstache. Craft beer brunch fashion axe bicycle rights, plaid messenger bag?" style:NSInformationalAlertStyle buttonTitles:@[@"Yes, Give me my Pabst", @"No"] view:self completion:^(NSModalResponse response) {

    }];
  } else if ([type isEqualTo:@"input"]) {
    [KBAlert promptForInputWithTitle:@"What's my favorite color?" description:@"Cold-pressed aesthetic yr fap locavore American Apparel, bespoke fanny pack." secure:NO style:NSInformationalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *input) {

    }];
  }
}

- (void)showTrackReplay:(NSString *)username {
  KBRUser *user = [[KBRUser alloc] initWithDictionary:@{@"username": username} error:nil];
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  userProfileView.popup = YES;
  NSWindow *window = [self openInWindow:userProfileView size:CGSizeMake(400, 400) title:@"Keybase"];
  [window setLevel:NSFloatingWindowLevel];

  KBRMockClient *mockClient = [[KBRMockClient alloc] init];
  [userProfileView setUser:user editable:NO client:mockClient];
  [mockClient replayRecordId:NSStringWithFormat(@"track/%@", username)];
  mockClient.completion(nil, nil);
}

- (void)showSelectKey {
  id params = [KBRMockClient paramsFromRecordId:@"signup/gbrl39" file:@"0003--keybase.1.gpgUi.selectKeyAndPushOption.json"];
  KBRSelectKeyAndPushOptionRequestParams *requestParams = [[KBRSelectKeyAndPushOptionRequestParams alloc] initWithParams:params];

  KBKeySelectView *selectView = [[KBKeySelectView alloc] init];
  [selectView.keysView setGPGKeys:requestParams.keys];
  __weak KBKeySelectView *gselectView = selectView;
  selectView.selectButton.targetBlock = ^{
    GHDebug(@"Selected key: %@", gselectView.keysView.selectedGPGKey.keyID);
  };
  selectView.cancelButton.actionBlock = ^(id sender) { [[sender window] close]; };
  [self openInWindow:selectView size:CGSizeMake(600, 400) title:@"Select PGP Key"];
}

- (void)showStyleGuide {
  KBStyleGuideView *testView = [[KBStyleGuideView alloc] init];
  [self openInWindow:testView size:CGSizeMake(600, 400) title:@"Keybase"];
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

- (void)showLogin {
  KBLoginView *loginView = [[KBLoginView alloc] init];
  KBRMockClient *mockClient = [[KBRMockClient alloc] init];
  loginView.client = mockClient;
  KBDevicePromptView *devicePromptView = [[KBDevicePromptView alloc] init];
  mockClient.handler = ^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    [loginView.navigation pushView:devicePromptView animated:YES];
    completion(nil, @{});
  };
  devicePromptView.completion = ^(id sender, NSError *error, NSString *deviceName) {
    KBRSelectSignerRequestParams *requestParams = [[KBRSelectSignerRequestParams alloc] initWithParams:[KBRMockClient paramsFromRecordId:@"device_setup/gbrl49" file:@"0000--keybase.1.doctorUi.selectSigner.json"]];
    [loginView selectSigner:requestParams completion:^(NSError *error, id result) {

    }];
  };
  [self openInWindow:loginView size:CGSizeMake(800, 600) title:@"Keybase"];
}

- (void)showDeviceSetupView {
  NSArray *params = [KBRMockClient paramsFromRecordId:@"device_setup/gbrl49" file:@"0000--keybase.1.doctorUi.selectSigner.json"];

  KBRSelectSignerRequestParams *requestParams = [[KBRSelectSignerRequestParams alloc] initWithParams:params];

  KBDeviceSetupView *deviceSetupView = [[KBDeviceSetupView alloc] init];
  [deviceSetupView setDevices:requestParams.devices hasPGP:requestParams.hasPGP];
  deviceSetupView.cancelButton.actionBlock = ^(id sender) { [[sender window] close]; };
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
