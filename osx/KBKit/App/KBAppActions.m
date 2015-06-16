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
#import "KBPGPEncrypt.h"
#import "KBWork.h"

@interface KBAppActions ()
@property KBService *service;
@end

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

- (KBService *)loadService {
  if (!_service) {
    KBEnvConfig *config = [KBEnvConfig loadFromUserDefaults:[KBWorkspace userDefaults]];
    _service = [[KBService alloc] initWithConfig:config];
  }
  return _service;
}

- (NSView *)encryptViewWithExtensionItem:(NSExtensionItem *)extensionItem completion:(KBOnExtension)completion {
  KBPGPEncryptActionView *encryptView = [[KBPGPEncryptActionView alloc] initWithFrame:CGRectMake(0, 0, 400, 300)];
  encryptView.extensionItem = extensionItem;
  encryptView.client = [self loadService].client;
  encryptView.completion = completion;
  return encryptView;
}

- (void)encryptExtensionItem:(NSExtensionItem *)extensionItem usernames:(NSArray *)usernames sender:(id)sender completion:(KBOnExtension)completion {
  KBPGPEncrypt *encrypt = [[KBPGPEncrypt alloc] init];
  KBRPClient *client = [self loadService].client;
  NSString *text = extensionItem.attributedContentText.string;
  [encrypt encryptText:text usernames:usernames client:client sender:sender completion:^(KBWork *work) {
    //NSError *error = [work error];
    // TODO: Handle error
    KBStream *stream = [work output];
    NSExtensionItem *item = [[NSExtensionItem alloc] init];
    NSAttributedString *text = [[NSAttributedString alloc] initWithString:[[NSString alloc] initWithData:stream.writer.data encoding:NSUTF8StringEncoding]];
    item.attributedContentText = text;
    completion(sender, item);
  }];
}

@end
