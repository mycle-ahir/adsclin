/**
 * Thin wrapper around proxy-chain's anonymizeProxy / closeAnonymizedProxy.
 *
 * Starts a local anonymous HTTP proxy that forwards all traffic to an upstream
 * proxy. This ensures:
 *   - Authenticated SOCKS5 works (Chromium does not support SOCKS5 auth natively)
 *   - Credentials are NEVER placed on Chromium's command line
 *
 * The forwarder binds to 127.0.0.1 with an OS-assigned random port.
 *
 * proxy-chain is require()'d at runtime because it uses CommonJS and we need to
 * avoid build issues with the ESM/CJS boundary in the Electron main process.
 */

export interface ForwarderHandle {
  /** Local proxy URL: http://127.0.0.1:<randomPort> */
  localUrl: string;
  /** Stop the local forwarder and release the port. */
  close(): Promise<void>;
}

/**
 * Starts a local anonymous HTTP proxy forwarding to the given upstream URL.
 *
 * @param upstreamUrl - Full proxy URL including credentials if any,
 *   e.g. "socks5://user:pass@host:port". NEVER log this value.
 */
export async function startForwarder(upstreamUrl: string): Promise<ForwarderHandle> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const proxyChain = require('proxy-chain') as typeof import('proxy-chain');
  const localUrl = await proxyChain.anonymizeProxy(upstreamUrl);
  return {
    localUrl,
    async close(): Promise<void> {
      // Swallow errors on close — the port may already be released
      await proxyChain.closeAnonymizedProxy(localUrl, true).catch(() => undefined);
    },
  };
}
