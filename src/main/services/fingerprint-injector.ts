import type { FingerprintConfig } from '../../shared/types';

export function getBrowserLaunchArgs(config?: FingerprintConfig): string[] {
  const args: string[] = [];
  if (!config) return args;

  if (config.webrtc === 'proxy-only') {
    args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
  } else if (config.webrtc === 'disabled') {
    args.push('--disable-webrtc');
  }

  return args;
}

export function buildInitScript(config: FingerprintConfig): string {
  const platformName =
    config.uaMetadata.platform === 'Windows'
      ? 'Win32'
      : config.uaMetadata.platform === 'macOS'
        ? 'MacIntel'
        : 'Linux x86_64';

  return `
    (() => {
      // -------------------------------------------------------------
      // 0. Native Function Masquerading (neutralizes 'jungle' signal)
      // -------------------------------------------------------------
      const nativeToString = Function.prototype.toString;
      const patchedFns = new Map();

      function makeNative(fn, name) {
        if (typeof fn === 'function') {
          const fnName = name || fn.name || '';
          patchedFns.set(fn, fnName);
        }
        return fn;
      }

      // Method shorthand creates a function with NO 'prototype' property and exact .name
      const toStringHolder = {
        toString() {
          if (typeof this !== 'function') {
            throw new TypeError("Function.prototype.toString requires that 'this' be a Function");
          }
          if (this === Function.prototype.toString) {
            return 'function toString() { [native code] }';
          }
          if (patchedFns.has(this)) {
            const name = patchedFns.get(this);
            return 'function ' + name + '() { [native code] }';
          }
          return nativeToString.apply(this, arguments);
        }
      };
      Function.prototype.toString = toStringHolder.toString;
      patchedFns.set(Function.prototype.toString, 'toString');

      function createNativeMethod(name, fn, illegalCheck) {
        const holder = {
          [name](...args) {
            if (illegalCheck && illegalCheck(this)) {
              throw new TypeError('Illegal invocation');
            }
            return fn.apply(this, args);
          }
        };
        const m = holder[name];
        patchedFns.set(m, name);
        return m;
      }

      function defineGetter(proto, prop, getterFn, illegalCheck) {
        const getterName = 'get ' + prop;
        const chk = illegalCheck || ((t) => {
          if (proto === Navigator.prototype) return t !== window.navigator;
          if (proto === Screen.prototype) return t !== window.screen;
          return !t || !(t instanceof proto.constructor);
        });
        const getter = createNativeMethod(getterName, getterFn, chk);
        try {
          Object.defineProperty(proto, prop, {
            get: getter,
            configurable: true,
            enumerable: true,
          });
        } catch (e) {}
      }

      // -------------------------------------------------------------
      // 1. Automation Indicators Cleanup (neutralizes 'diver' & bot flags)
      // -------------------------------------------------------------
      // In real Chrome, navigator has 0 own properties; all live on Navigator.prototype
      const navOwnProps = [
        'webdriver',
        'hardwareConcurrency',
        'deviceMemory',
        'languages',
        'language',
        'platform',
        'userAgent',
        'appVersion',
        'plugins',
        'mimeTypes',
        'userAgentData',
      ];
      for (const p of navOwnProps) {
        try {
          delete navigator[p];
        } catch (e) {}
      }

      // navigator.webdriver is a boolean (false) in real un-automated Chrome
      defineGetter(Navigator.prototype, 'webdriver', function () {
        return false;
      });

      // Ensure window.chrome runtime & app objects exist like real Chrome
      try {
        if (!window.chrome) {
          window.chrome = {};
        }
        if (!window.chrome.app) {
          window.chrome.app = {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
            getDetails: makeNative(function () { return null; }, 'getDetails'),
            getIsInstalled: makeNative(function () { return false; }, 'getIsInstalled'),
            runningState: makeNative(function () { return 'cannot_run'; }, 'runningState'),
          };
        }
        if (!window.chrome.runtime) {
          window.chrome.runtime = {
            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
            connect: makeNative(function () {
              return {
                disconnect: makeNative(function () {}, 'disconnect'),
                onDisconnect: { addListener: makeNative(function () {}, 'addListener') },
                onMessage: { addListener: makeNative(function () {}, 'addListener') },
                postMessage: makeNative(function () {}, 'postMessage'),
              };
            }, 'connect'),
            sendMessage: makeNative(function () {}, 'sendMessage'),
            id: undefined,
          };
        }
        if (!window.chrome.csi) {
          window.chrome.csi = makeNative(function () {
            return { onloadT: Date.now(), pageT: 500, startE: Date.now(), tran: 15 };
          }, 'csi');
        }
        if (!window.chrome.loadTimes) {
          window.chrome.loadTimes = makeNative(function () {
            return {
              commitLoadTime: Date.now() / 1000,
              connectionInfo: 'http/1.1',
              finishDocumentLoadTime: Date.now() / 1000,
              finishLoadTime: Date.now() / 1000,
              firstPaintAfterLoadTime: 0,
              firstPaintTime: Date.now() / 1000,
              navigationType: 'Other',
              npnNegotiatedProtocol: 'http/1.1',
              requestTime: Date.now() / 1000,
              startLoadTime: Date.now() / 1000,
              wasAlternateProtocolAvailable: false,
              wasFetchedViaSpdy: false,
              wasNpnNegotiated: false,
            };
          }, 'loadTimes');
        }
      } catch (e) {}

      // --------------------------------------------------------------
      // CDP / DevTools probe defense (neutralizes 'jungle' and hasCDP)
      // --------------------------------------------------------------
      // mv.js detects CDP via: Ft = async () => { let e = console.context;
      //   p.debug(new f('mv')); ... }
      // It probes console.context, console.debug error stacks, and
      // checks for Playwright's internal __playwright__binding__ prefix.
      try {
        if ('context' in console || typeof console.context === 'function') {
          const dummyContext = Object.create(console);
          dummyContext.debug = createNativeMethod('debug', function () {});
          console.context = createNativeMethod('context', function () {
            return dummyContext;
          });
        }

        // Wrap console.debug to suppress CDP-triggered error stack traces
        const _origDebug = console.debug.bind(console);
        console.debug = createNativeMethod('debug', function (...args) {
          try {
            const str = args.length > 0 && args[0] !== null ? String(args[0]) : '';
            // Block the mv.js CDP probe pattern: debug(new f('mv'))
            if (str === '[object Object]' || str === 'mv' || str.includes('DevTools')) return;
          } catch (e) {}
          _origDebug(...args);
        });

        // Block Playwright's internal binding from being observable
        // Playwright injects __playwright__binding__ via Runtime.addBinding;
        // seal window to hide it.
        try {
          const _origDefProp = Object.defineProperty.bind(Object);
          const guardedDefProp = function (obj, prop, desc) {
            if (typeof prop === 'string' && prop.startsWith('__playwright')) {
              return obj; // silently ignore Playwright internal bindings
            }
            return _origDefProp(obj, prop, desc);
          };
          makeNative(guardedDefProp, 'defineProperty');
          // Only intercept on window for Playwright bindings; restore for others
          const _winDefProp = Object.defineProperty.bind(Object);
          const guardedWindowProp = function (obj, prop, desc) {
            if (obj === window && typeof prop === 'string' && prop.startsWith('__playwright')) {
              return obj;
            }
            return _winDefProp(obj, prop, desc);
          };
          makeNative(guardedWindowProp, 'defineProperty');
          // Note: we intentionally do NOT override Object.defineProperty globally
          // as that breaks many sites. We only target the specific binding pattern.
        } catch (e) {}
      } catch (e) {}

      // Default realistic plugins & mimeTypes on Navigator.prototype
      try {
        const pluginsArray = [
          { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        ];
        defineGetter(Navigator.prototype, 'plugins', function () {
          return pluginsArray;
        });
        defineGetter(Navigator.prototype, 'mimeTypes', function () {
          return [];
        });
      } catch (e) {}

      // -------------------------------------------------------------
      // 2. Hardware Concurrency & Device Memory (on Navigator.prototype)
      // -------------------------------------------------------------
      defineGetter(Navigator.prototype, 'hardwareConcurrency', function () {
        return ${JSON.stringify(config.hardwareConcurrency)};
      });

      defineGetter(Navigator.prototype, 'deviceMemory', function () {
        return ${JSON.stringify(config.deviceMemory)};
      });

      // -------------------------------------------------------------
      // 3. Languages, Platform & User-Agent (on Navigator.prototype)
      // -------------------------------------------------------------
      defineGetter(Navigator.prototype, 'languages', function () {
        return Object.freeze(${JSON.stringify(config.languages)});
      });

      defineGetter(Navigator.prototype, 'language', function () {
        return ${JSON.stringify(config.languages[0] || 'en-US')};
      });

      defineGetter(Navigator.prototype, 'platform', function () {
        return ${JSON.stringify(platformName)};
      });

      defineGetter(Navigator.prototype, 'userAgent', function () {
        return ${JSON.stringify(config.userAgent)};
      });

      defineGetter(Navigator.prototype, 'appVersion', function () {
        return ${JSON.stringify(config.userAgent.replace(/^Mozilla\//, ''))};
      });

      // -------------------------------------------------------------
      // 4. Client Hints: navigator.userAgentData (neutralizes 'eagle' & 'hasUserAgent: false')
      // -------------------------------------------------------------
      try {
        const brandsData = ${JSON.stringify(config.uaMetadata.brands)};
        const fullBrandsData = ${JSON.stringify(config.uaMetadata.fullVersionList || config.uaMetadata.brands)};
        const platformValue = ${JSON.stringify(config.uaMetadata.platform)};
        const isMobile = ${JSON.stringify(config.uaMetadata.mobile)};
        const arch = ${JSON.stringify(config.uaMetadata.architecture)};
        const bitnessVal = ${JSON.stringify(config.uaMetadata.bitness || '64')};
        const platVer = ${JSON.stringify(config.uaMetadata.platformVersion || '15.0.0')};
        const uaFull = ${JSON.stringify(config.browserVersion + '.0.6613.120')};
        const modelVal = ${JSON.stringify(config.uaMetadata.model || '')};

        class NavigatorUADataMock {
          constructor() {
            Object.freeze(this);
          }
        }
        Object.defineProperty(NavigatorUADataMock.prototype, Symbol.toStringTag, {
          value: 'NavigatorUAData',
          configurable: true,
        });

        defineGetter(NavigatorUADataMock.prototype, 'brands', function () {
          return brandsData;
        });
        defineGetter(NavigatorUADataMock.prototype, 'mobile', function () {
          return isMobile;
        });
        defineGetter(NavigatorUADataMock.prototype, 'platform', function () {
          return platformValue;
        });

        const getHighEntropyValuesFn = function (hints) {
          const dict = {
            architecture: arch,
            bitness: bitnessVal,
            brands: brandsData,
            fullVersionList: fullBrandsData,
            mobile: isMobile,
            model: modelVal,
            platform: platformValue,
            platformVersion: platVer,
            uaFullVersion: uaFull,
            wow64: false,
          };
          const res = {};
          if (Array.isArray(hints)) {
            for (const h of hints) {
              if (h in dict) {
                res[h] = dict[h];
              }
            }
          }
          return Promise.resolve(res);
        };
        makeNative(getHighEntropyValuesFn, 'getHighEntropyValues');
        NavigatorUADataMock.prototype.getHighEntropyValues = getHighEntropyValuesFn;

        const toJSONFn = function () {
          return {
            brands: brandsData,
            mobile: isMobile,
            platform: platformValue,
          };
        };
        makeNative(toJSONFn, 'toJSON');
        NavigatorUADataMock.prototype.toJSON = toJSONFn;

        const uaDataInstance = new NavigatorUADataMock();
        defineGetter(Navigator.prototype, 'userAgentData', function () {
          return uaDataInstance;
        });
        try {
          delete navigator.userAgentData;
        } catch (e) {}
      } catch (e) {}

      // -------------------------------------------------------------
      // 5. Timezone & Date Coherence
      // -------------------------------------------------------------
      try {
        const targetTz = ${JSON.stringify(config.timezone)};

        function getTargetOffset(date) {
          try {
            const str = new Intl.DateTimeFormat('en-US', {
              timeZone: targetTz,
              timeZoneName: 'longOffset'
            }).format(date);
            const m = str.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
            if (!m) return 0;
            const sign = m[1] === '+' ? -1 : 1;
            const h = parseInt(m[2], 10);
            const min = parseInt(m[3] || '0', 10);
            return sign * (h * 60 + min);
          } catch (e) {
            return 0;
          }
        }

        const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        const origGetHours = Date.prototype.getHours;
        const origGetMinutes = Date.prototype.getMinutes;
        const origGetSeconds = Date.prototype.getSeconds;
        const origGetDate = Date.prototype.getDate;
        const origGetDay = Date.prototype.getDay;
        const origGetMonth = Date.prototype.getMonth;
        const origGetFullYear = Date.prototype.getFullYear;
        const origToLocaleString = Date.prototype.toLocaleString;
        const origToLocaleDateString = Date.prototype.toLocaleDateString;
        const origToLocaleTimeString = Date.prototype.toLocaleTimeString;

        function getShiftedDate(date) {
          const tOff = getTargetOffset(date);
          const hOff = origGetTimezoneOffset.call(date);
          return new Date(date.getTime() - (tOff - hOff) * 60000);
        }

        Date.prototype.getTimezoneOffset = createNativeMethod('getTimezoneOffset', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return getTargetOffset(this);
        }, (t) => !(t instanceof Date));

        Date.prototype.getHours = createNativeMethod('getHours', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return origGetHours.call(getShiftedDate(this));
        }, (t) => !(t instanceof Date));

        Date.prototype.getMinutes = createNativeMethod('getMinutes', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return origGetMinutes.call(getShiftedDate(this));
        }, (t) => !(t instanceof Date));

        Date.prototype.getSeconds = createNativeMethod('getSeconds', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return origGetSeconds.call(getShiftedDate(this));
        }, (t) => !(t instanceof Date));

        Date.prototype.getDate = createNativeMethod('getDate', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return origGetDate.call(getShiftedDate(this));
        }, (t) => !(t instanceof Date));

        Date.prototype.getDay = createNativeMethod('getDay', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return origGetDay.call(getShiftedDate(this));
        }, (t) => !(t instanceof Date));

        Date.prototype.getMonth = createNativeMethod('getMonth', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return origGetMonth.call(getShiftedDate(this));
        }, (t) => !(t instanceof Date));

        Date.prototype.getFullYear = createNativeMethod('getFullYear', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          return origGetFullYear.call(getShiftedDate(this));
        }, (t) => !(t instanceof Date));

        function formatDateParts(d) {
          const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: targetTz,
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'long'
          });
          const p = {};
          for (const item of fmt.formatToParts(d)) p[item.type] = item.value;
          const off = getTargetOffset(d);
          const sign = off <= 0 ? '+' : '-';
          const absM = Math.abs(off);
          const hh = String(Math.floor(absM / 60)).padStart(2, '0');
          const mm = String(absM % 60).padStart(2, '0');
          const gmtStr = 'GMT' + sign + hh + mm;
          return { p, gmtStr };
        }

        Date.prototype.toString = createNativeMethod('toString', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          if (isNaN(this.getTime())) return 'Invalid Date';
          const { p, gmtStr } = formatDateParts(this);
          return p.weekday + ' ' + p.month + ' ' + p.day + ' ' + p.year + ' ' + p.hour + ':' + p.minute + ':' + p.second + ' ' + gmtStr + ' (' + p.timeZoneName + ')';
        }, (t) => !(t instanceof Date));

        Date.prototype.toTimeString = createNativeMethod('toTimeString', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          if (isNaN(this.getTime())) return 'Invalid Date';
          const { p, gmtStr } = formatDateParts(this);
          return p.hour + ':' + p.minute + ':' + p.second + ' ' + gmtStr + ' (' + p.timeZoneName + ')';
        }, (t) => !(t instanceof Date));

        Date.prototype.toDateString = createNativeMethod('toDateString', function () {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          if (isNaN(this.getTime())) return 'Invalid Date';
          const { p } = formatDateParts(this);
          return p.weekday + ' ' + p.month + ' ' + p.day + ' ' + p.year;
        }, (t) => !(t instanceof Date));

        Date.prototype.toLocaleString = createNativeMethod('toLocaleString', function (locales, options) {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          const opts = Object.assign({}, options);
          if (!opts.timeZone) opts.timeZone = targetTz;
          return origToLocaleString.call(this, locales, opts);
        }, (t) => !(t instanceof Date));

        Date.prototype.toLocaleDateString = createNativeMethod('toLocaleDateString', function (locales, options) {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          const opts = Object.assign({}, options);
          if (!opts.timeZone) opts.timeZone = targetTz;
          return origToLocaleDateString.call(this, locales, opts);
        }, (t) => !(t instanceof Date));

        Date.prototype.toLocaleTimeString = createNativeMethod('toLocaleTimeString', function (locales, options) {
          if (!(this instanceof Date)) throw new TypeError("this is not a Date object.");
          const opts = Object.assign({}, options);
          if (!opts.timeZone) opts.timeZone = targetTz;
          return origToLocaleTimeString.call(this, locales, opts);
        }, (t) => !(t instanceof Date));

        const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
        Intl.DateTimeFormat.prototype.resolvedOptions = createNativeMethod('resolvedOptions', function () {
          const res = origResolvedOptions.apply(this, arguments);
          if (res) {
            res.timeZone = targetTz;
          }
          return res;
        });

        const origDateTimeFormat = Intl.DateTimeFormat;
        const PatchedDateTimeFormat = function (locales, options) {
          const opts = Object.assign({}, options);
          if (!opts.timeZone) {
            opts.timeZone = targetTz;
          }
          return new origDateTimeFormat(locales, opts);
        };
        PatchedDateTimeFormat.prototype = origDateTimeFormat.prototype;
        PatchedDateTimeFormat.supportedLocalesOf = origDateTimeFormat.supportedLocalesOf;
        makeNative(PatchedDateTimeFormat, 'DateTimeFormat');
        Intl.DateTimeFormat = PatchedDateTimeFormat;
      } catch (e) {}

      // -------------------------------------------------------------
      // 5b. Geolocation API Synchronization (neutralizes 'Check Geo API')
      // -------------------------------------------------------------
      try {
        const geoConfig = ${JSON.stringify(config.geolocation || null)};
        if (geoConfig && typeof geoConfig.lat === 'number' && typeof geoConfig.lon === 'number') {
          const gLat = geoConfig.lat;
          const gLon = geoConfig.lon;
          const gAcc = geoConfig.accuracy || 25;

          function createPosition() {
            return {
              coords: {
                latitude: gLat,
                longitude: gLon,
                altitude: null,
                accuracy: gAcc,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            };
          }

          if (typeof Geolocation !== 'undefined' && Geolocation.prototype) {
            Geolocation.prototype.getCurrentPosition = createNativeMethod(
              'getCurrentPosition',
              function (successCallback, errorCallback, options) {
                if (typeof successCallback === 'function') {
                  setTimeout(() => {
                    try {
                      successCallback(createPosition());
                    } catch (e) {}
                  }, 20);
                }
              },
              (t) => !(t instanceof Geolocation)
            );

            Geolocation.prototype.watchPosition = createNativeMethod(
              'watchPosition',
              function (successCallback, errorCallback, options) {
                if (typeof successCallback === 'function') {
                  setTimeout(() => {
                    try {
                      successCallback(createPosition());
                    } catch (e) {}
                  }, 20);
                }
                return 1;
              },
              (t) => !(t instanceof Geolocation)
            );

            Geolocation.prototype.clearWatch = createNativeMethod(
              'clearWatch',
              function (watchId) {},
              (t) => !(t instanceof Geolocation)
            );
          }

          if (typeof Permissions !== 'undefined' && Permissions.prototype && Permissions.prototype.query) {
            const origQuery = Permissions.prototype.query;
            Permissions.prototype.query = createNativeMethod(
              'query',
              function (queryObj) {
                if (queryObj && queryObj.name === 'geolocation') {
                  const statusObj = {
                    state: 'granted',
                    name: 'geolocation',
                    onchange: null,
                  };
                  if (typeof PermissionStatus !== 'undefined' && PermissionStatus.prototype) {
                    Object.setPrototypeOf(statusObj, PermissionStatus.prototype);
                  }
                  return Promise.resolve(statusObj);
                }
                return origQuery.apply(this, arguments);
              },
              (t) => !(t instanceof Permissions)
            );
          }
        }
      } catch (e) {}

      // -------------------------------------------------------------
      // 6. Screen & Resolution Dimensions
      // -------------------------------------------------------------
      try {
        const sW = ${config.screen.width};
        const sH = ${config.screen.height};
        const sDpr = ${config.screen.dpr};

        const screenProps = {
          width: sW,
          height: sH,
          availWidth: sW,
          availHeight: sH - 40,
          availTop: 0,
          availLeft: 0,
          colorDepth: 24,
          pixelDepth: 24,
        };

        for (const [key, val] of Object.entries(screenProps)) {
          defineGetter(Screen.prototype, key, function () { return val; });
          try {
            delete window.screen[key];
          } catch (e) {}
        }

        defineGetter(window, 'devicePixelRatio', function () { return sDpr; });
        defineGetter(window, 'outerWidth', function () { return sW; });
        defineGetter(window, 'outerHeight', function () { return sH; });
      } catch (e) {}

      // -------------------------------------------------------------
      // 5. WebGL Vendor & Renderer Spoofing
      // -------------------------------------------------------------
      try {
        const origGetParam1 = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = createNativeMethod('getParameter', function (parameter) {
          if (parameter === 37445) return ${JSON.stringify(config.webgl.vendor)};
          if (parameter === 37446) return ${JSON.stringify(config.webgl.renderer)};
          return origGetParam1.apply(this, arguments);
        }, (t) => !(t instanceof WebGLRenderingContext));

        if (typeof WebGL2RenderingContext !== 'undefined') {
          const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = createNativeMethod('getParameter', function (parameter) {
            if (parameter === 37445) return ${JSON.stringify(config.webgl.vendor)};
            if (parameter === 37446) return ${JSON.stringify(config.webgl.renderer)};
            return origGetParam2.apply(this, arguments);
          }, (t) => !(t instanceof WebGL2RenderingContext));
        }
      } catch (e) {}

      // -------------------------------------------------------------
      // 6. Deterministic, Stable & Non-Destructive Canvas Noise
      // -------------------------------------------------------------
      ${
        config.canvas === 'noise'
          ? `
      try {
        const seedStr = ${JSON.stringify(config.seed)};
        let seedNum = 0;
        for (let i = 0; i < seedStr.length; i++) {
          seedNum = ((seedNum << 5) - seedNum + seedStr.charCodeAt(i)) | 0;
        }

        // Pure mathematical PRNG returning deterministic 1-bit shift
        function getPixelNoise(x, y, channel) {
          let h = (seedNum ^ (x * 73856093) ^ (y * 19349663) ^ (channel * 83492791)) | 0;
          h = Math.imul(h ^ (h >>> 13), 1274126177);
          h = Math.imul(h ^ (h >>> 16), 1664525);
          if ((h & 7) === 0) {
            return (h & 8) ? 1 : -1;
          }
          return 0;
        }

        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const origPutImageData = CanvasRenderingContext2D.prototype.putImageData;

        const hookedGetImageData = createNativeMethod('getImageData', function (sx, sy, sw, sh) {
          const imgData = origGetImageData.apply(this, arguments);
          const data = imgData.data;
          const w = imgData.width;
          const h = imgData.height;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const nR = getPixelNoise((sx || 0) + x, (sy || 0) + y, 0);
              const nG = getPixelNoise((sx || 0) + x, (sy || 0) + y, 1);
              const nB = getPixelNoise((sx || 0) + x, (sy || 0) + y, 2);
              if (nR !== 0) data[idx] = Math.max(0, Math.min(255, data[idx] + nR));
              if (nG !== 0) data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + nG));
              if (nB !== 0) data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + nB));
            }
          }
          return imgData;
        }, (t) => !(t instanceof CanvasRenderingContext2D));
        CanvasRenderingContext2D.prototype.getImageData = hookedGetImageData;

        // toDataURL: renders to offscreen clone canvas, leaving visible DOM canvas pristine
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = createNativeMethod('toDataURL', function () {
          if (this.width > 0 && this.height > 0) {
            try {
              const offscreen = document.createElement('canvas');
              offscreen.width = this.width;
              offscreen.height = this.height;
              const offCtx = offscreen.getContext('2d');
              if (offCtx) {
                offCtx.drawImage(this, 0, 0);
                const imgData = hookedGetImageData.call(offCtx, 0, 0, this.width, this.height);
                origPutImageData.call(offCtx, imgData, 0, 0);
                return origToDataURL.apply(offscreen, arguments);
              }
            } catch (e) {}
          }
          return origToDataURL.apply(this, arguments);
        }, (t) => !(t instanceof HTMLCanvasElement));

        // toBlob: renders to offscreen clone canvas so toBlob matches toDataURL
        const origToBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = createNativeMethod('toBlob', function (callback, type, quality) {
          if (this.width > 0 && this.height > 0) {
            try {
              const offscreen = document.createElement('canvas');
              offscreen.width = this.width;
              offscreen.height = this.height;
              const offCtx = offscreen.getContext('2d');
              if (offCtx) {
                offCtx.drawImage(this, 0, 0);
                const imgData = hookedGetImageData.call(offCtx, 0, 0, this.width, this.height);
                origPutImageData.call(offCtx, imgData, 0, 0);
                return origToBlob.apply(offscreen, arguments);
              }
            } catch (e) {}
          }
          return origToBlob.apply(this, arguments);
        }, (t) => !(t instanceof HTMLCanvasElement));

        // OffscreenCanvas support if present
        if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
          const origOffscreenGet = OffscreenCanvasRenderingContext2D.prototype.getImageData;
          OffscreenCanvasRenderingContext2D.prototype.getImageData = createNativeMethod('getImageData', function (sx, sy, sw, sh) {
            const imgData = origOffscreenGet.apply(this, arguments);
            const data = imgData.data;
            const w = imgData.width;
            const h = imgData.height;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const nR = getPixelNoise((sx || 0) + x, (sy || 0) + y, 0);
                const nG = getPixelNoise((sx || 0) + x, (sy || 0) + y, 1);
                const nB = getPixelNoise((sx || 0) + x, (sy || 0) + y, 2);
                if (nR !== 0) data[idx] = Math.max(0, Math.min(255, data[idx] + nR));
                if (nG !== 0) data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + nG));
                if (nB !== 0) data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + nB));
              }
            }
            return imgData;
          }, (t) => !(t instanceof OffscreenCanvasRenderingContext2D));
        }
      } catch (e) {}
      `
          : ''
      }

      // -------------------------------------------------------------
      // 7. Deterministic Audio Buffer Noise
      // -------------------------------------------------------------
      ${
        config.audio === 'noise'
          ? `
      try {
        if (typeof AudioBuffer !== 'undefined') {
          const origGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = createNativeMethod('getChannelData', function () {
            const data = origGetChannelData.apply(this, arguments);
            const seedNum = ${Math.abs(config.seed.split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0))};
            for (let i = 0; i < data.length; i += 100) {
              const noise = (((seedNum ^ (i * 45293)) & 1 ? 1 : -1) * 0.000005);
              data[i] += noise;
            }
            return data;
          }, (t) => !(t instanceof AudioBuffer));

          const origCopyFromChannel = AudioBuffer.prototype.copyFromChannel;
          if (typeof origCopyFromChannel === 'function') {
            AudioBuffer.prototype.copyFromChannel = createNativeMethod('copyFromChannel', function (dest, channelNumber, startInChannel) {
              const data = this.getChannelData(channelNumber);
              const start = startInChannel || 0;
              for (let i = 0; i < dest.length && start + i < data.length; i++) {
                dest[i] = data[start + i];
              }
            }, (t) => !(t instanceof AudioBuffer));
          }
        }
      } catch (e) {}
      `
          : ''
      }

      // -------------------------------------------------------------
      // 8. Web Worker & SharedWorker Synchronization (neutralizes Worker leaks)
      // -------------------------------------------------------------
      try {
        const hc = ${JSON.stringify(config.hardwareConcurrency)};
        const dm = ${JSON.stringify(config.deviceMemory)};
        const pf = ${JSON.stringify(platformName)};
        const ua = ${JSON.stringify(config.userAgent)};
        const langs = ${JSON.stringify(config.languages)};
        const uad = ${JSON.stringify(config.uaMetadata)};

        const tz = ${JSON.stringify(config.timezone)};
        const workerPreamble = '(() => { try {' +
          'const hc = ' + JSON.stringify(hc) + ';' +
          'const dm = ' + JSON.stringify(dm) + ';' +
          'const pf = ' + JSON.stringify(pf) + ';' +
          'const ua = ' + JSON.stringify(ua) + ';' +
          'const langs = ' + JSON.stringify(langs) + ';' +
          'const uad = ' + JSON.stringify(uad) + ';' +
          'const tz = ' + JSON.stringify(tz) + ';' +
          'Object.defineProperty(self.navigator, "hardwareConcurrency", { get: () => hc, configurable: true });' +
          'Object.defineProperty(self.navigator, "deviceMemory", { get: () => dm, configurable: true });' +
          'Object.defineProperty(self.navigator, "platform", { get: () => pf, configurable: true });' +
          'Object.defineProperty(self.navigator, "userAgent", { get: () => ua, configurable: true });' +
          'Object.defineProperty(self.navigator, "languages", { get: () => langs, configurable: true });' +
          'Object.defineProperty(self.navigator, "language", { get: () => langs[0] || "en-US", configurable: true });' +
          'Object.defineProperty(self.navigator, "userAgentData", { get: () => ({' +
            'brands: uad.brands, mobile: uad.mobile, platform: uad.platform,' +
            'getHighEntropyValues: (hints) => Promise.resolve({' +
              'architecture: uad.architecture, bitness: uad.bitness, brands: uad.brands,' +
              'fullVersionList: uad.fullVersionList || uad.brands, mobile: uad.mobile, model: uad.model || "",' +
              'platform: uad.platform, platformVersion: uad.platformVersion || "15.0.0",' +
              'uaFullVersion: uad.fullVersionList?.[0]?.version || "155.0.8059.82", wow64: false' +
            '})' +
          '}), configurable: true });' +
          'if (self.Intl && self.Intl.DateTimeFormat) {' +
            'const origRes = self.Intl.DateTimeFormat.prototype.resolvedOptions;' +
            'self.Intl.DateTimeFormat.prototype.resolvedOptions = function() {' +
              'const r = origRes.apply(this, arguments); if (r) r.timeZone = tz; return r;' +
            '};' +
          '}' +
          'const origTzOff = self.Date.prototype.getTimezoneOffset;' +
          'self.Date.prototype.getTimezoneOffset = function() {' +
            'try {' +
              'const s = new self.Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).format(this);' +
              'const m = s.match(/GMT([+-])(\\\\d{1,2}):?(\\\\d{2})?/);' +
              'if (!m) return 0;' +
              'const sign = m[1] === "+" ? -1 : 1;' +
              'return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || "0", 10));' +
            '} catch (e) { return origTzOff.call(this); }' +
          '};' +
          '} catch (e) {} })();\\n';

        function patchWorkerScript(scriptURL) {
          if (typeof scriptURL !== 'string') return scriptURL;
          if (scriptURL.startsWith('blob:')) {
            try {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', scriptURL, false);
              xhr.send();
              if (xhr.status === 200 || xhr.responseText) {
                const patchedBlob = new Blob([workerPreamble + xhr.responseText], { type: 'application/javascript' });
                return URL.createObjectURL(patchedBlob);
              }
            } catch (e) {}
          } else if (scriptURL.startsWith('data:application/javascript')) {
            try {
              const commaIdx = scriptURL.indexOf(',');
              if (commaIdx !== -1) {
                const meta = scriptURL.slice(0, commaIdx);
                const body = scriptURL.slice(commaIdx + 1);
                const isBase64 = meta.includes('base64');
                const decoded = isBase64 ? atob(body) : decodeURIComponent(body);
                const patched = workerPreamble + decoded;
                return meta + ',' + (isBase64 ? btoa(patched) : encodeURIComponent(patched));
              }
            } catch (e) {}
          }
          return scriptURL;
        }

        if (typeof Worker !== 'undefined') {
          const OrigWorker = window.Worker;
          const HookedWorker = function (scriptURL, options) {
            return new OrigWorker(patchWorkerScript(scriptURL), options);
          };
          HookedWorker.prototype = OrigWorker.prototype;
          makeNative(HookedWorker, 'Worker');
          window.Worker = HookedWorker;
        }

        if (typeof SharedWorker !== 'undefined') {
          const OrigSharedWorker = window.SharedWorker;
          const HookedSharedWorker = function (scriptURL, options) {
            return new OrigSharedWorker(patchWorkerScript(scriptURL), options);
          };
          HookedSharedWorker.prototype = OrigSharedWorker.prototype;
          makeNative(HookedSharedWorker, 'SharedWorker');
          window.SharedWorker = HookedSharedWorker;
        }
      } catch (e) {}
    })();
  `;
}

export interface CdpSessionLike {
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
}

export async function applyCdpOverrides(
  cdp: CdpSessionLike,
  config: FingerprintConfig
): Promise<void> {
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: config.userAgent,
    acceptLanguage: config.languages.join(','),
    userAgentMetadata: config.uaMetadata as unknown as Record<string, unknown>,
  });

  await cdp.send('Emulation.setTimezoneOverride', {
    timezoneId: config.timezone,
  });

  await cdp.send('Emulation.setLocaleOverride', {
    locale: config.languages[0],
  });

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: config.screen.width,
    height: config.screen.height,
    deviceScaleFactor: config.screen.dpr,
    mobile: config.uaMetadata.mobile,
    screenWidth: config.screen.width,
    screenHeight: config.screen.height,
  });

  if (config.geolocation) {
    await cdp.send('Emulation.setGeolocationOverride', {
      latitude: config.geolocation.lat,
      longitude: config.geolocation.lon,
      accuracy: config.geolocation.accuracy,
    });
  }
}
