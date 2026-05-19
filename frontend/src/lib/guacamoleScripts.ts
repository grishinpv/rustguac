/** Guacamole script load order — full interactive client (static/client.html). */
export const GUAC_CLIENT_SCRIPTS = [
  '/guac/Namespace.js',
  '/guac/Client.js',
  '/guac/Display.js',
  '/guac/Event.js',
  '/guac/InputSink.js',
  '/guac/IntegerPool.js',
  '/guac/Keyboard.js',
  '/guac/KeyEventInterpreter.js',
  '/guac/Layer.js',
  '/guac/Mouse.js',
  '/guac/Parser.js',
  '/guac/Position.js',
  '/guac/Status.js',
  '/guac/Touch.js',
  '/guac/Tunnel.js',
  '/guac/UTF8Parser.js',
  '/guac/InputStream.js',
  '/guac/OutputStream.js',
  '/guac/StringReader.js',
  '/guac/StringWriter.js',
  '/guac/ArrayBufferReader.js',
  '/guac/ArrayBufferWriter.js',
  '/guac/BlobReader.js',
  '/guac/BlobWriter.js',
  '/guac/DataURIReader.js',
  '/guac/AudioContextFactory.js',
  '/guac/AudioPlayer.js',
  '/guac/AudioRecorder.js',
  '/guac/VideoPlayer.js',
  '/guac/H264Decoder.js',
  '/guac/JSONReader.js',
  '/guac/Object.js',
  '/guac/RawAudioFormat.js',
  '/guac/SessionRecording.js',
]

/** Recording player (static/recordings.html) — no H264Decoder. */
export const GUAC_RECORDING_SCRIPTS = GUAC_CLIENT_SCRIPTS.filter((s) => !s.includes('H264Decoder.js'))

export function loadScriptOnce(src: string): Promise<void> {
  const existing = document.querySelector(`script[src="${src}"]`)
  if (existing) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(el)
  })
}

export async function loadGuacamoleChain(scripts: string[]) {
  for (const src of scripts) {
    await loadScriptOnce(src)
  }
}
