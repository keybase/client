//
//  KBFSUtils.h
//  Keybase
//

#import <Foundation/Foundation.h>

@interface KBFSUtils : NSObject
+(BOOL)checkAbsolutePath:(NSString *)path hasAbsolutePrefix:(NSString *)prefix;
+(BOOL)checkIfPathIsFishy:(NSString *)path;
// The symlink's destination, or nil if linkPath isn't a symlink.
+(NSString *)resolveLinkPath:(NSString *)linkPath;
@end
