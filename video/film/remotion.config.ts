import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(94);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709"); // one colourspace everywhere, or joins reset filters
Config.setChromiumOpenGlRenderer("swangle"); // the WebGL that works headless on this machine
Config.setConcurrency(2); // RAM is shared with the eval run: keep it low
Config.setOffthreadVideoCacheSizeInBytes(600 * 1024 * 1024);
Config.setDelayRenderTimeoutInMilliseconds(120000);
