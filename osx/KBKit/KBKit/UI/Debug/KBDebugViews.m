//
//  KBDebugViews.m
//  Keybase
//
//  Created by Gabriel on 1/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDebugViews.h"

#import "KBApp.h"
#import "KBUserProfileView.h"
#import "KBWebView.h"
#import "KBPGPKeyGenView.h"
#import "KBProveView.h"
#import "KBStyleGuideView.h"
#import "KBKeySelectView.h"
#import "KBDeviceSetupChooseView.h"
#import "KBRMockClient.h"

#import "KBDeviceSetupPromptView.h"
#import "KBProgressView.h"
#import "KBKeyImportView.h"
#import "KBDeviceSetupDisplayView.h"
#import "KBDeviceAddView.h"
#import "KBPGPEncryptView.h"
#import "KBPGPEncryptActionView.h"
#import "KBPGPOutputView.h"
#import "KBPGPEncryptFilesView.h"
#import "KBPGPOutputFileView.h"
#import "KBPGPDecryptView.h"
#import "KBPGPDecryptFileView.h"
#import "KBPGPSignView.h"
#import "KBPGPSignFileView.h"
#import "KBPrivilegedTask.h"
#import "KBLoginView.h"
#import "KBSignupView.h"
#import "KBFile.h"
#import "KBSecretPromptView.h"
#import "KBAppExtension.h"
#import "KBAppProgressView.h"
#import "KBPaperKeyDisplayView.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@implementation KBDebugViews

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:NSColor.whiteColor];

  YOVBox *contentView = [YOVBox box];

  [contentView addSubview:[KBButton linkWithText:@"Components" targetBlock:^{ [self showComponents]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Loading" targetBlock:^{ [self showAppProgress]; }]];

  [contentView addSubview:[KBButton linkWithText:@"Login" targetBlock:^{ [self showLogin]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Signup" targetBlock:^{ [self showSignup]; }]];

  [contentView addSubview:[KBButton linkWithText:@"Device Setup (Prompt)" targetBlock:^{ [self showDeviceSetupPrompt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Setup (Choose)" targetBlock:^{ [self showDeviceSetupChoose]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Setup (Display)" targetBlock:^{ [self showDeviceSetupDisplay]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Device Add" targetBlock:^{ [self showDeviceAdd]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Paper Key (Display)" targetBlock:^{ [self showPaperKeyDisplay]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Select GPG Key" targetBlock:^{ [self showSelectKey]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Import Key" targetBlock:^{ [self showImportKey]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Prove" targetBlock:^{ [self showProve:@"twitter"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Prove Instructions" targetBlock:^{ [self showProveInstructions]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Web View" targetBlock:^{ [self showWebView]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Track (alice)" targetBlock:^{ [self showTrack:@"t_alice"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Track (charlie)" targetBlock:^{ [self showTrack:@"t_charlie"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Track (doug)" targetBlock:^{ [self showTrack:@"t_doug"]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Progress" targetBlock:^{ [self showProgressView:1 error:NO]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Progress (error)" targetBlock:^{ [self showProgressView:0 error:YES]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Error" targetBlock:^{ [self showError]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"Secret (Password)" targetBlock:^{ [self prompt:@"password"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Secret (PGP Unlock)" targetBlock:^{ [self prompt:@"pgp_unlock"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Input" targetBlock:^{ [self prompt:@"input"]; }]];
  [contentView addSubview:[KBButton linkWithText:@"Yes/No" targetBlock:^{ [self prompt:@"yes_no"]; }]];

  [contentView addSubview:[KBBox lineWithInsets:UIEdgeInsetsMake(10, 10, 10, 10)]];

  [contentView addSubview:[KBButton linkWithText:@"PGP Encrypt (Text)" targetBlock:^{ [self showPGPEncrypt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Encrypt (Files)" targetBlock:^{ [self showPGPEncryptFile]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Output" targetBlock:^{ [self showPGPOutput]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Output (Files)" targetBlock:^{ [self showPGPFileOutput]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Decrypt (Text)" targetBlock:^{ [self showPGPDecrypt]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Decrypt (Files)" targetBlock:^{ [self showPGPDecryptFile]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Sign" targetBlock:^{ [self showPGPSign]; }]];
  [contentView addSubview:[KBButton linkWithText:@"PGP Sign (File)" targetBlock:^{ [self showPGPSignFile]; }]];

  [contentView addSubview:[KBButton linkWithText:@"PGP Encrypt (Action)" targetBlock:^{ [self showPGPEncryptAction]; }]];

  [self addSubview:contentView];
  self.viewLayout = [YOLayout fitVertical:contentView];
}

- (void)open:(id)sender {
  [[sender window] kb_addChildWindowForView:self rect:CGRectMake(0, 40, 400, 600) position:KBWindowPositionLeft title:@"Debug" fixed:NO makeKey:NO];
}

- (void)showComponents {
  KBStyleGuideView *view = [[KBStyleGuideView alloc] init];
  [self openInWindow:[KBScrollView scrollViewWithDocumentView:view] size:CGSizeMake(500, 400) title:@"Components"];
}

- (void)showProgressView:(NSTimeInterval)delay error:(BOOL)error {
  KBProgressView *progressView = [[KBProgressView alloc] init];
  [progressView setProgressTitle:@"Working"];
  progressView.work = ^(KBCompletion completion) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      completion(error ? KBMakeErrorWithRecovery(-1, @"Some error happened", @"Intelligentsia ennui squid put a bird on it mixtape next level. Paleo Neutra banh mi fingerstache, small batch stumptown skateboard mustache asymmetrical vegan. Quinoa mustache mixtape literally occupy mlkshk..") : nil);
    });
  };
  [progressView openAndDoIt:(KBWindow *)self.window];
}

- (void)showProve:(NSString *)serviceName {
  [KBProveView createProofWithServiceName:serviceName client:self.client sender:self completion:^(id sender, BOOL success) {
  }];
}

- (void)setError:(NSError *)error {
  [[NSAlert alertWithError:error] beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse returnCode) {
  }];
}

- (NSWindow *)openInWindow:(YOView *)view size:(CGSize)size title:(NSString *)title {
  if ([view respondsToSelector:@selector(setClient:)]) {
    if (![(id)view client]) [(id)view setClient:(KBRPClient *)self.client];
  }
  return [self.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, size.width, size.height) position:KBWindowPositionCenter title:title fixed:NO makeKey:YES];
}

- (void)prompt:(NSString *)type {
  if ([type isEqualTo:@"password"]) {

  } else if ([type isEqualTo:@"pgp_unlock"]) {
    KBSecretPromptView *secretPrompt = [[KBSecretPromptView alloc] init];
    [secretPrompt setHeader:@"Your key passphrase" info:@"Please enter the passphrase to unlock this key." details:@"Please enter the passphrase to unlock the secret key for:\nuser: TestIt <gabrielh+test@gmail.com>\n4096-bit RSA key, ID 96D952D8C35E39CC, created 2015-05-29\n\nReason: Import of key into keybase keyring" previousError:@"Failed to unlock key; bad passphrase"];

    [secretPrompt openInWindow:(KBWindow *)self.window];
    secretPrompt.completion = ^(NSString *password) {
      DDLogDebug(@"Password length: %@", @(password.length));
    };

  } else if ([type isEqualTo:@"yes_no"]) {
    [KBAlert yesNoWithTitle:@"Are you a hipster?" description:@"Flexitarian biodiesel locavore fingerstache. Craft beer brunch fashion axe bicycle rights, plaid messenger bag?" yes:@"Beer Me" view:self completion:^(BOOL yes) {
      // Yes
    }];
  } else if ([type isEqualTo:@"input"]) {
    [KBAlert promptForInputWithTitle:@"What's my favorite color?" description:@"Cold-pressed aesthetic yr fap locavore American Apparel, bespoke fanny pack." secure:NO style:NSInformationalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:nil completion:^(NSModalResponse response, NSString *input) {

    }];
  }
}

- (void)showTrack:(NSString *)username {
  KBUserProfileView *userProfileView = [[KBUserProfileView alloc] init];
  userProfileView.popup = YES;
  userProfileView.fromWindow = (KBWindow *)[self window];
  [userProfileView openPopupWindow];

  [userProfileView setUsername:username client:self.client];
}

- (void)showSelectKey {
  id params = [KBRMockClient requestForMethod:@"keybase.1.gpgUi.selectKeyAndPushOption"];
  KBRSelectKeyAndPushOptionRequestParams *requestParams = [[KBRSelectKeyAndPushOptionRequestParams alloc] initWithParams:params];

  KBKeySelectView *selectView = [[KBKeySelectView alloc] init];
  [selectView setGPGKeys:requestParams.keys];
  selectView.completion = ^(id sender, id response) { [[sender window] close]; };
  [self openInWindow:selectView size:CGSizeMake(600, 400) title:@"Keybase"];
}

- (void)showImportKey {
  KBKeyImportView *keyImportView = [[KBKeyImportView alloc] init];
  keyImportView.completion = ^(id sender, BOOL imported) { [[sender window] close]; };
  [self openInWindow:keyImportView size:CGSizeMake(600, 400) title:@"Import Key"];
}

- (void)showDeviceSetupDisplay {
  KBDeviceSetupDisplayView *secretWordsView = [[KBDeviceSetupDisplayView alloc] init];
  [secretWordsView setSecretWords:@"profit tiny dumb cherry explain poet" deviceNameExisting:@"Macbook (Work)" deviceNameToAdd:@"Macbook (Home)"];
  secretWordsView.button.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) { [[button window] close]; };
  [self openInWindow:secretWordsView size:CGSizeMake(600, 400) title:@"Keybase"];
}

- (void)showDeviceAdd {
  KBDeviceAddView *view = [[KBDeviceAddView alloc] init];
  view.completion = ^(id sender, BOOL ok) { [[sender window] close]; };
  [self openInWindow:view size:CGSizeMake(600, 400) title:@"Keybase"];
}

- (void)showProveInstructions {
  KBProveInstructionsView *instructionsView = [[KBProveInstructionsView alloc] init];
  NSString *proofText = @"Seitan four dollar toast banh mi, ethical ugh umami artisan paleo brunch listicle synth try-hard pop-up. Next level mixtape selfies, freegan Schlitz bitters Echo Park semiotics. Gentrify sustainable farm-to-table, cliche crucifix biodiesel ennui taxidermy try-hard cold-pressed Brooklyn fixie narwhal Bushwick Pitchfork. Ugh Etsy chia 3 wolf moon, drinking vinegar street art yr stumptown cliche Thundercats Marfa umami beard shabby chic Portland. Skateboard Vice four dollar toast stumptown, salvia direct trade hoodie. Wes Anderson swag small batch vinyl, taxidermy biodiesel Shoreditch cray pickled kale chips typewriter deep v. Actually XOXO tousled, freegan Marfa squid trust fund cardigan irony.\n\nPaleo pork belly heirloom dreamcatcher gastropub tousled. Banjo bespoke try-hard, gentrify Pinterest pork belly Schlitz sartorial narwhal Odd Future biodiesel 8-bit before they sold out selvage. Brunch disrupt put a bird on it Neutra organic. Pickled dreamcatcher post-ironic sriracha, organic Austin Bushwick Odd Future Marfa. Narwhal heirloom Tumblr forage trust fund, roof party gentrify keffiyeh High Life synth kogi Banksy. Kitsch photo booth slow-carb pour-over Etsy, Intelligentsia raw denim lomo. Brooklyn PBR&B Kickstarter direct trade literally, jean shorts photo booth narwhal irony kogi.";
  [instructionsView setProofText:proofText serviceName:@"twitter"];
  [self openInWindow:instructionsView size:CGSizeMake(560, 420) title:@"Keybase"];
}

- (void)showLogin {
  KBLoginView *loginView = [[KBLoginView alloc] init];
  [self openInWindow:loginView size:CGSizeMake(800, 600) title:@"Keybase"];

  KBDeviceSetupPromptView *devicePromptView = [[KBDeviceSetupPromptView alloc] init];

  KBDeviceSetupDisplayView *secretWordsView = [[KBDeviceSetupDisplayView alloc] init];
  [secretWordsView setSecretWords:@"profit tiny dumb cherry explain poet" deviceNameExisting:@"Macbook (Work)" deviceNameToAdd:@"Macbook (Home)"];

  KBNavigationView *navigation = loginView.navigation;
  loginView.loginButton.targetBlock = ^{ [navigation pushView:devicePromptView animated:YES]; };
  KBDeviceSetupChooseView *deviceSetupView = [self deviceSetupChooseView];
  devicePromptView.completion = ^(id sender, NSError *error, NSString *deviceName) { [navigation pushView:deviceSetupView animated:YES]; };
  deviceSetupView.selectButton.targetBlock = ^{ [navigation pushView:secretWordsView animated:YES]; };
  secretWordsView.button.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) { [[button window] close]; };
}

- (void)showSignup {
  KBSignupView *signUpView = [[KBSignupView alloc] init];
  KBRMockClient *mockClient = [[KBRMockClient alloc] init];
  mockClient.handler = ^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, @{});
  };
  signUpView.client = mockClient;
  signUpView.completion = ^(id sender) { [[sender window] close]; };
  [self openInWindow:signUpView size:CGSizeMake(800, 600) title:@"Keybase"];
}

- (void)showAppProgress {
  KBAppProgressView *view = [[KBAppProgressView alloc] init];
  [view setProgressTitle:@"Connecting"];
  view.animating = YES;
  [self openInWindow:view size:CGSizeMake(800, 600) title:@"Keybase"];
}

- (void)showDeviceSetupPrompt {
  KBDeviceSetupPromptView *devicePromptView = [[KBDeviceSetupPromptView alloc] init];
  devicePromptView.completion = ^(id sender, NSError *error, NSString *deviceName) { [[sender window] close]; };
  [self openInWindow:devicePromptView size:CGSizeMake(600, 400) title:@"Keybase"];
}

- (KBDeviceSetupChooseView *)deviceSetupChooseView {
  KBRDevice *device1 = [[KBRDevice alloc] init];
  device1.name = @"Macbook";
  device1.type = @"desktop";

  KBRDevice *device2 = [[KBRDevice alloc] init];
  device2.name = @"Macbook (Work)";
  device2.type = @"desktop";

  KBRDevice *device3 = [[KBRDevice alloc] init];
  device3.name = @"Web";
  device3.type = @"web";

  KBDeviceSetupChooseView *deviceSetupView = [[KBDeviceSetupChooseView alloc] init];
  [deviceSetupView setDevices:@[device1, device2, device3] hasPGP:YES];
  deviceSetupView.cancelButton.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) { [[button window] close]; };
  return deviceSetupView;
}

- (void)showDeviceSetupChoose {
  [self openInWindow:[self deviceSetupChooseView] size:CGSizeMake(700, 500) title:@"Keybase"];
}

- (void)showPaperKeyDisplay {
  NSString *phrase = @"industry clip thank brief salad street hobby banana tennis hip frequent illness fringe hair";
  KBPaperKeyDisplayView *view = [[KBPaperKeyDisplayView alloc] init];
  [view setPhrase:phrase];
  view.button.dispatchBlock = ^(KBButton *button, dispatch_block_t completion) { [[button window] close]; };
  [self openInWindow:view size:CGSizeMake(700, 500) title:@"Keybase"];
}

- (void)showPGPEncrypt {
  KBPGPEncryptView *encryptView = [[KBPGPEncryptView alloc] init];

  [encryptView addUsername:@"t_alice"];
  [encryptView setText:@"This is a test"];
  [self openInWindow:encryptView size:CGSizeMake(600, 400) title:@"Encrypt"];
}

- (void)showPGPEncryptAction {
  NSExtensionItem *item = [[NSExtensionItem alloc] init];
  NSAttributedString *text = [[NSAttributedString alloc] initWithString:@"Test"];
  item.attributedContentText = text;

  KBAppExtension *app = [[KBAppExtension alloc] init];
  NSView *view = [app encryptViewWithExtensionItem:item completion:^(id sender, NSExtensionItem *outputItem) {
    DDLogDebug(@"Output: %@", outputItem);
    [[sender window] close];
  }];
  [self.window kb_addChildWindowForView:view size:view.frame.size makeKey:YES];
}

- (void)showPGPEncryptFile {
  KBPGPEncryptFilesView *encryptView = [[KBPGPEncryptFilesView alloc] init];
  [encryptView addFile:[KBFile fileWithPath:@"/Users/gabe/Downloads/test4.mp4"]];
  [encryptView addFile:[KBFile fileWithPath:@"/Users/gabe/Downloads/test-a-really-long-file-name-what-happens?.txt"]];
  [self openInWindow:encryptView size:CGSizeMake(600, 400) title:@"Encrypt Files"];
}

- (void)showPGPOutput {
  KBPGPOutputView *view = [[KBPGPOutputView alloc] init];
  [self openInWindow:view size:CGSizeMake(600, 400) title:@"Keybase"];
}

- (void)showPGPFileOutput {
  KBPGPOutputFileView *view = [[KBPGPOutputFileView alloc] init];
  [view setFiles:@[[KBFile fileWithPath:@"/Users/gabe/Downloads/test4.mp4.gpg"],
                   [KBFile fileWithPath:@"/Users/gabe/Downloads/test-a-really-long-file-name-what-happens?.txt.gpg"]]];

  [self openInWindow:view size:CGSizeMake(600, 400) title:@"Keybase"];
}

- (void)showPGPDecrypt {
  KBPGPDecryptView *decryptView = [[KBPGPDecryptView alloc] init];
  NSData *data = [NSData dataWithContentsOfFile:[NSBundle.mainBundle pathForResource:@"test" ofType:@"asc"]];
  [decryptView setData:data armored:YES];
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
  [KBActivity setError:error sender:self];
}

- (void)showWebView {
  KBWebView *webView = [[KBWebView alloc] init];
  [webView openURLString:@"https://twitter.com/"];
  [self openInWindow:webView size:CGSizeMake(800, 600) title:@"Twitter"];
}

@end
