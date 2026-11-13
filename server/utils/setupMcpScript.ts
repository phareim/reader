// setup-mcp.sh, bundled into the Worker at build time (Nitro's `raw:` import).
// A Worker has no filesystem, so reading it from process.cwd() at request
// time always failed (500). Nitro hands `.sh` over as bytes (its mime type is
// not text/*), so decode it once here.
import scriptBytes from 'raw:../../setup-mcp.sh'

export const setupMcpScript: string =
  typeof scriptBytes === 'string' ? scriptBytes : new TextDecoder().decode(scriptBytes as Uint8Array)
