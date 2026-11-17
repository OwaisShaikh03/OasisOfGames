// Static guide: how to make Unity WebGL builds smaller and faster
const SECTIONS = [
  {
    title: "1. Measure first",
    items: [
      ["Compare before and after", "Upload your unoptimized build and your optimized build, play each one on the Fast 4G connection, and open Compare. Change one thing at a time so you know what helped.", ""],
      ["Find what is big", "After a build, Unity writes a list of the largest assets to the Editor log, sorted by size. Textures and audio are usually at the top.", "Console window menu > Open Editor Log"],
    ],
  },
  {
    title: "2. Download size",
    items: [
      ["Compress the build", "Brotli gives the smallest files. Gzip also works but is usually larger. Brotli only works on HTTPS or localhost, and the server must send the correct Content-Encoding header, which this platform does for you. In this platform's four test games, Brotli cut the transfer size by 71 to 79% and the load time on Fast 4G by 69 to 77%.", "Player Settings > Publishing Settings > Compression Format"],
      ["Shrink textures", "Textures are often the biggest part of the .data file. Lower the Max Size where players will not notice, use a compressed format, and try crunch compression to reduce the download. Turn off Read/Write Enabled unless a script needs it, and turn off mipmaps for UI and 2D sprites.", "Select the texture > Inspector"],
      ["Compress audio", "Use the Vorbis format, lower the quality for sound effects, and use Force To Mono where stereo is not needed. Trim long music tracks.", "Select the audio clip > Inspector"],
      ["Remove what you do not use", "Everything in a Resources folder is always included in the build, even if nothing uses it, so keep it small. Remove unused packages as well.", "Window > Package Manager"],
      ["Load big content on demand", "Addressables let you download large or rarely used content only when it is needed, so the first load stays small.", "Window > Asset Management > Addressables"],
    ],
  },
  {
    title: "3. Code size (the .wasm file)",
    items: [
      ["Strip unused code", "Set Managed Stripping Level to High and enable Strip Engine Code. Test the build afterwards, because stripping can remove code that is only used through reflection.", "Player Settings > Other Settings"],
      ["Smaller generated code", "Choose the smaller code option for IL2CPP. It builds a smaller .wasm file, with a small speed trade-off in some cases.", "Player Settings > Other Settings > IL2CPP Code Generation"],
    ],
  },
  {
    title: "4. Loading experience",
    items: [
      ["Data caching", "Data Caching keeps downloaded files in the browser so repeat visits are fast. This is good for players but hides the real download cost, which is why this platform has a Fresh download option for testing.", "Player Settings > Publishing Settings > Data Caching"],
      ["Decompression Fallback", "Only turn it on if your host cannot send the Content-Encoding header. It adds extra code to the loader and makes startup slower.", "Player Settings > Publishing Settings"],
    ],
  },
  {
    title: "5. Frame rate and memory",
    items: [
      ["Reduce draw calls", "Bake lighting instead of using many real-time lights, and use static batching, GPU instancing or the SRP Batcher so the browser has less to draw. Keep post-processing light on WebGL.", ""],
      ["Avoid memory spikes", "Creating lots of short-lived objects in Update triggers garbage collection, which shows up as stutters (a low minimum FPS). Reuse objects with pooling.", ""],
      ["Watch the memory limit", "Browsers limit memory, especially on phones. Large textures and many loaded assets are the usual cause of crashes. The JS heap number on this platform does not capture all of Unity's own WebAssembly memory, so use it as a rough guide.", ""],
      ["Profile properly", "Use the Unity Profiler on a development build to find what is slow, then confirm the result in a real browser on this platform.", "Window > Analysis > Profiler"],
    ],
  },
  {
    title: "6. Getting reliable test results",
    items: [
      ["Repeat the test", "Run each build at least 3 times under the same condition. Compare shows whether the difference is statistically significant.", ""],
      ["Keep conditions the same", "Use the same browser, close other tabs and apps, and prefer the Fresh download option so the browser cache does not change the result.", ""],
      ["Know the FPS limit", "FPS is capped by your screen's refresh rate. On a 60 Hz screen a game that could run faster still shows about 60.", ""],
    ],
  },
];

export default function Learn() {
  return (
    <div className="container">
      <h2>Learn: optimizing Unity WebGL builds</h2>
      <p className="hint">
        Short, practical steps for making a build smaller and faster to load in a browser. Menu names can differ slightly
        between Unity versions.
      </p>
      {SECTIONS.map((s) => (
        <div className="report" key={s.title}>
          <h3>{s.title}</h3>
          {s.items.map(([title, detail, where]) => (
            <div className="ritem ok" key={title}>
              <span className="ricon">✓</span>
              <div>
                <strong>{title}</strong>
                <div className="rdetail">{detail}</div>
                {where && <div className="rfix">Where: {where}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}