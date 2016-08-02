//
//  KBAppExtension.m
//  Keybase
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBAppExtension.h"

#import "KBPGPEncryptActionView.h"
#import "KBWorkspace.h"
#import "KBPGPEncrypt.h"
#import "KBWork.h"
#import "KBRPClient.h"

#import <CocoaLumberjack/CocoaLumberjack.h>

@interface KBAppExtension ()
@property (nonatomic) KBRPClient *client;
@end

@implementation KBAppExtension

- (KBRPClient *)client {
  if (!_client) {
    KBEnvConfig *config = [KBEnvConfig envConfigFromUserDefaults:[KBWorkspace userDefaults]];
    _client = [[KBRPClient alloc] initWithConfig:config options:KBRClientOptionsAutoRetry];
  }
  return _client;
}

- (NSView *)encryptViewWithExtensionItem:(NSExtensionItem *)extensionItem completion:(KBOnExtension)completion {
  KBPGPEncryptActionView *encryptView = [[KBPGPEncryptActionView alloc] initWithFrame:CGRectMake(0, 0, 400, 300)];
  encryptView.extensionItem = extensionItem;
  encryptView.client = self.client;
  encryptView.completion = completion;
  return encryptView;
}

- (void)encryptExtensionItem:(NSExtensionItem *)extensionItem usernames:(NSArray *)usernames sender:(id)sender completion:(KBOnExtension)completion {
  KBPGPEncrypt *encrypt = [[KBPGPEncrypt alloc] init];
  KBRPClient *client = self.client;
  NSString *text = extensionItem.attributedContentText.string;
  [encrypt encryptText:text usernames:usernames client:client sender:sender completion:^(KBWork *work, BOOL stop) {
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
