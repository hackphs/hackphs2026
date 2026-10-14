# hackPHS 2026 recap

The organizer supplied the corrected Canva export from design `DAHXtiwpX0o` on
October 13, 2026: `hackphs 2026 video (with music).mp4` in Downloads.
The downloaded original is preserved outside the website assets. The web copy is
792 × 444 H.264 / AAC with MP4 fast-start; it keeps the complete 3:38.18 recap
at the export's native resolution, without upscaling. The AAC audio is copied
unchanged, preserving the supplied music and volume.
The poster is a frame from the supplied video, not a generated image.

Encoding: FFmpeg, `-c:v libx264 -preset fast -crf 26
-maxrate 700k -bufsize 1400k -pix_fmt yuv420p -c:a copy
-movflags +faststart`.

The pop-up appears once per browser-tab session on the homepage, can be dismissed
with Close, Escape, or the backdrop, and can be reopened with Watch the 2026 recap.
Playback requires a user action. The video source is attached only when opened.

The earlier export was silent after approximately 6.38 seconds. It has been
replaced with the music-inclusive export. Silence detection on the corrected
source found only its final 1.18 seconds silent. Video and poster URLs are
versioned to prevent browsers reusing the old export.
