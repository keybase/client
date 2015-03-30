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
#import "KBKeyImportView.h"
#import "KBSecretWordsView.h"
#import "KBSecretWordsInputView.h"
#import "KBPGPEncryptView.h"
#import "KBPGPOutputView.h"
#import "KBPGPEncryptFileView.h"
#import "KBPGPOutputFileView.h"
#import "KBPGPDecryptView.h"
#import "KBPGPDecryptFileView.h"
#import "KBPGPSignView.h"
#import "KBPGPSignFileView.h"

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

  YOVBox *contentView = [YOVBox box:@{@"spacing": @"4", @"insets": @"20"}];
  [contentView addSubview:[KBLabel labelWithText:@"Style Guides" style:KBTextStyleHeader]];
  [contentView addSubview:[KBButton linkWithText:@"Style Guide" targetBlock:^{ [self showStyleGuide]; }]];
  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBLabel labelWithText:@"Mocks" style:KBTextStyleHeader]];
  [contentView addSubview:[KBLabel labelWithText:@"These views use mock data!" style:KBTextStyleDefault]];

  [contentView addSubview:[KBButton linkWithText:@"PGP Encrypt (Text)" targetBlock:^{ [self showPGPEncrypt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Encrypt (Files)" targetBlock:^{ [self showPGPEncryptFile]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Output" targetBlock:^{ [self showPGPOutput]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Output (Files)" targetBlock:^{ [self showPGPFileOutput]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Decrypt (Text)" targetBlock:^{ [self showPGPDecrypt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Decrypt (Files)" targetBlock:^{ [self showPGPDecryptFile]; }]];
  
  [contentView addSubview:[KBButton linkWithText:@"PGP Sign" targetBlock:^{ [self showPGPSign]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Sign (File)" targetBlock:^{ [self showPGPSignFile]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"App" targetBlock:^{ [self showAppView]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Login" targetBlock:^{ [self showLogin]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Signup" targetBlock:^{ [self showSignup]; }]];

  [contentView addSubview:[KBButton linkWithText:@"Device Setup" targetBlock:^{ [self showDeviceSetupView]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Prompt" targetBlock:^{ [self showDevicePrompt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Secret Words" targetBlock:^{ [self showSecretWords]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Secret Words (Input)" targetBlock:^{ [self showSecretWordsInput]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Select GPG Key" targetBlock:^{ [self showSelectKey]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Import Key" targetBlock:^{ [self showImportKey]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Prove" targetBlock:^{ [self showProve:KBProveTypeTwitter]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Prove Instructions" targetBlock:^{ [self showProveInstructions]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Track" targetBlock:^{ [self showTrack]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Progress" targetBlock:^{ [self showProgressView:1 error:NO]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Progress (error)" targetBlock:^{ [self showProgressView:0 error:YES]; }]];

  [contentView addSubview:[KBButton linkWithText:@"Error" targetBlock:^{ [self showError]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Fatal" targetBlock:^{ [self showFatalError]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

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

- (void)showProve:(KBProveType)type {
  [KBProveView connectWithProveType:type client:self.mockClient sender:self completion:^(BOOL canceled) {

  }];
}

- (void)setError:(NSError *)error {
  [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse returnCode) {
  }];
}

- (NSWindow *)openInWindow:(KBContentView *)view size:(CGSize)size title:(NSString *)title {
  view.client = self.mockClient;
  return [self.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, size.width, size.height) position:KBWindowPositionCenter title:title errorHandler:^(NSError *error, id sender) { [self setError:error]; }];
}

- (void)prompt:(NSString *)type {
  if ([type isEqualTo:@"password"]) {
    [KBAlert promptForInputWithTitle:@"Your secret password" description:@"Williamsburg heirloom Carles. Meggings sriracha High Life keytar photo booth craft beer. Artisan keytar cliche, Pinterest mumblecore 8-bit hella kale chips" secure:YES style:NSCriticalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *password) {

    }];
  } else if ([type isEqualTo:@"yes_no"]) {
    [KBAlert yesNoWithTitle:@"Are you a hipster?" description:@"Flexitarian biodiesel locavore fingerstache. Craft beer brunch fashion axe bicycle rights, plaid messenger bag?" yes:@"Beer Me" view:self completion:^(BOOL yes) {
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
  userProfileView.client = mockClient;
  [userProfileView setUsername:@"test" editable:NO];
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
  selectView.cancelButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) { [[button window] close]; };
  [self openInWindow:selectView size:CGSizeMake(600, 400) title:nil];
}

- (void)showImportKey {
  KBKeyImportView *keyImportView = [[KBKeyImportView alloc] init];
  keyImportView.cancelButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) { [[button window] close]; };
  [self openInWindow:keyImportView size:CGSizeMake(600, 400) title:nil];
}

- (void)showSecretWords {
  KBSecretWordsView *secretWordsView = [[KBSecretWordsView alloc] init];
  [secretWordsView setSecretWords:@"exotic element night course funny grain pourover mustache lumbersexual" deviceNameToRegister:@"Macbook (Home)"];
  secretWordsView.button.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) { [[button window] close]; };
  [self openInWindow:secretWordsView size:CGSizeMake(600, 400) title:nil];
}

- (void)showSecretWordsInput {
  KBSecretWordsInputView *view = [[KBSecretWordsInputView alloc] init];
  view.inputField.text = @"heirloom squid kitsch retro typewriter pbr pourover mustache lumbersexual";
  view.completion = ^(NSString *words) {

  };
  [self openInWindow:view size:CGSizeMake(600, 400) title:nil];
}

- (void)showStyleGuide {
  KBStyleGuideView *testView = [[KBStyleGuideView alloc] init];
  [self openInWindow:testView size:CGSizeMake(300, 400) title:nil];
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
  deviceSetupView.cancelButton.dispatchBlock = ^(KBButton *button, KBButtonCompletion completion) { [[button window] close]; };
  [self openInWindow:deviceSetupView size:CGSizeMake(560, 420) title:nil];
}

- (void)showDevicePrompt {
  KBDevicePromptView *devicePromptView = [[KBDevicePromptView alloc] init];
  devicePromptView.completion = ^(id sender, NSError *error, NSString *deviceName) {
    [[sender window] close];
  };
  [self openInWindow:devicePromptView size:CGSizeMake(600, 400) title:nil];
}

- (void)showPGPEncrypt {
  KBPGPEncryptView *encryptView = [[KBPGPEncryptView alloc] init];

  [encryptView addUsername:@"t_alice"];
  [encryptView setText:@"This is a test"];
  [self openInWindow:encryptView size:CGSizeMake(600, 400) title:@"Encrypt"];
}

- (void)showPGPEncryptFile {
  KBPGPEncryptFileView *encryptView = [[KBPGPEncryptFileView alloc] init];
  [encryptView addFile:[KBFile fileWithPath:@"/Users/gabe/Downloads/test4.mp4"]];
  [encryptView addFile:[KBFile fileWithPath:@"/Users/gabe/Downloads/test-a-really-long-file-name-what-happens?.txt"]];
  [self openInWindow:encryptView size:CGSizeMake(600, 400) title:@"Encrypt Files"];
}

- (void)showPGPOutput {
  KBPGPOutputView *view = [[KBPGPOutputView alloc] init];
  [self openInWindow:view size:CGSizeMake(600, 400) title:nil];
}

- (void)showPGPFileOutput {
  KBPGPOutputFileView *view = [[KBPGPOutputFileView alloc] init];
  [view setFiles:@[[KBFile fileWithPath:@"/Users/gabe/Downloads/test4.mp4.gpg"],
                   [KBFile fileWithPath:@"/Users/gabe/Downloads/test-a-really-long-file-name-what-happens?.txt.gpg"]]];

  [self openInWindow:view size:CGSizeMake(600, 400) title:nil];
}

- (void)showPGPDecrypt {
  KBPGPDecryptView *decryptView = [[KBPGPDecryptView alloc] init];
  NSData *data = [NSData dataWithContentsOfFile:[NSBundle.mainBundle pathForResource:@"test" ofType:@"asc"]];
  [decryptView setASCIIData:data];
  [self openInWindow:decryptView size:CGSizeMake(600, 400) title:@"Decrypt"];
}

- (void)showPGPDecryptFile {
  KBPGPDecryptFileView *decryptView = [[KBPGPDecryptFileView alloc] init];
  [self openInWindow:decryptView size:CGSizeMake(600, 400) title:@"Decrypt"];
}

- (void)showPGPSign {
  KBPGPSignView *signView = [[KBPGPSignView alloc] init];
  [self openInWindow:signView size:CGSizeMake(600, 400) title:@"Sign"];
}

- (void)showPGPSignFile {
  KBPGPSignFileView *signView = [[KBPGPSignFileView alloc] init];
  [self openInWindow:signView size:CGSizeMake(400, 400) title:@"Sign File"];
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
