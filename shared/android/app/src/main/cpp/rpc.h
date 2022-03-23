#pragma once
#include <cstddef>
#include <cstdint>
#include <jsi/jsi.h>
#include <memory>

facebook::jsi::Value RpcOnGo(facebook::jsi::Runtime &runtime,
                             const facebook::jsi::Value &thisValue,
                             const facebook::jsi::Value *arguments,
                             size_t count,
                             void (*callback)(void *ptr, size_t size));

void RpcOnJS(facebook::jsi::Runtime &runtime, std::shared_ptr<uint8_t> data,
             int size);
