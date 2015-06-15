//
//  KBAppActions.m
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBAppActions.h"

#import "KBPGPEncryptView.h"
#import "KBPGPEncryptFilesView.h"
#import "KBPGPDecryptView.h"
#import "KBPGPDecryptFileView.h"
#import "KBPGPSignView.h"
#import "KBPGPSignFileView.h"
#import "KBPGPSignFilesView.h"
#import "KBPGPVerifyView.h"
#import "KBPGPVerifyFileView.h"
#import "KBWorkspace.h"
#import "KBPGPEncryptActionView.h"

@implementation KBAppActions

- (IBAction)encrypt:(id)sender {
  KBPGPEncryptView *view = [[KBPGPEncryptView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt" fixed:NO makeKey:YES];
}

- (IBAction)encryptFile:(id)sender {
  KBPGPEncryptFilesView *view = [[KBPGPEncryptFilesView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Encrypt Files" fixed:NO makeKey:YES];
}

- (IBAction)decrypt:(id)sender {
  KBPGPDecryptView *view = [[KBPGPDecryptView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt" fixed:NO makeKey:YES];
}

- (IBAction)decryptFile:(id)sender {
  KBPGPDecryptFileView *view = [[KBPGPDecryptFileView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Decrypt Files" fixed:NO makeKey:YES];
}

- (IBAction)sign:(id)sender {
  KBPGPSignView *view = [[KBPGPSignView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 510, 400) position:KBWindowPositionCenter title:@"Sign" fixed:NO makeKey:YES];
}

- (IBAction)signFile:(id)sender {
  KBPGPSignFileView *view = [[KBPGPSignFileView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Sign File" fixed:NO makeKey:YES];
}

- (IBAction)signFiles:(id)sender {
  KBPGPSignFilesView *view = [[KBPGPSignFilesView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Sign Files" fixed:NO makeKey:YES];
}

- (IBAction)verify:(id)sender {
  KBPGPVerifyView *view = [[KBPGPVerifyView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify" fixed:NO makeKey:YES];
}

- (IBAction)verifyFile:(id)sender {
  KBPGPVerifyFileView *view = [[KBPGPVerifyFileView alloc] init];
  view.client = self.app.service.client;
  [self.app.mainWindow kb_addChildWindowForView:view rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Verify File" fixed:NO makeKey:YES];
}

+ (NSView *)encryptWithExtensionItem:(NSExtensionItem *)extensionItem completion:(KBOnExtension)completion {
  KBPGPEncryptActionView *encryptView = [[KBPGPEncryptActionView alloc] initWithFrame:CGRectMake(0, 0, 400, 300)];

  encryptView.extensionItem = extensionItem;

  KBEnvConfig *config = [KBEnvConfig loadFromUserDefaults:[KBWorkspace userDefaults]];
  KBService *service = [[KBService alloc] initWithConfig:config];
  encryptView.client = service.client;

  encryptView.completion = completion;
  return encryptView;
}

@end
