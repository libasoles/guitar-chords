\version "2.19.35"

% Abel Fleury, La Cimarrona (ranchera). Antigua Casa Nunez (impreso el 21 de abril de 1942, Buenos Aires).
% Transcrito a mano del escaneo (resources/fleury/la-cimarrona.pdf). Alturas absolutas que suenan
% (la guitarra escribe una octava mas alta). Sin digitacion; se omiten adornos (acciaccature) y rasgueos.
% Lectura dudosa, marcada con [?]: acordes arpegiados con alteraciones (c. 17 y 19) y el compas final del Trio.

\header {
  title = "La Cimarrona"
  subtitle = "Ranchera"
  composer = "Abel Fleury"
}

upper = \fixed c {
  \key a \major
  \time 3/4
  \tempo "Ranchera"
  \partial 4.
  cis''8 cis''8[ b'8] |
  % --- Primera parte (pagina 2, sistemas 1 y 2)
  b'8\segno a'8 gis'8 a'8 gis'8 fis'8 |
  b'4. gis'8 gis'8[( fis'8)] |
  b'4 <b d' gis'>4 <b d' fis'>4 |
  a'4. fis'8 fis'8[( e'8)] |
  a'4 <a cis' fis'>4 <a cis' e'>4 |
  gis'4. fis'8 fis'8[( e'8)] |
  gis'4 <gis b e'>4 d'4 |
  s4 r8 cis''8 cis''8[ b'8] |
  % --- Repeticion con final distinto (sistemas 3 y 4)
  b'8 a'8 gis'8 a'8 gis'8 fis'8 |
  b'4. gis'8 gis'8[( fis'8)] |
  b'4 <b d' gis'>4 <b d' fis'>4 |
  a'4. fis'8 fis'8[( e'8)] |
  a'8 fis'8[( e'8)] a'8 fis'8[( e'8)] |
  <gis cis' e' gis'>4 r8 e''8 gis'8[ e''8] |
  gis'8[ e''8] gis'8[ e''8] gis'8[ e''8] |
  a'4 a'4 r4 |
  % --- Segunda parte (pagina 2, sistemas 5 y 6; pagina 3, sistema 1)
  <e a cis' e'>2 <eis ais cis' eis'>4 |
  <fis b d' fis'>2. |
  <d gis b d'>2 <dis fis a cis' e'>4 |
  <e a cis' e'>2. |
  <a' cis''>4 <gis' b'>4 <fis' a'>4 |
  gis'4 b'4 gis'4 |
  fis'4 a'4 fis'4 |
  e'2. |
  <e a cis' e'>2 <eis ais cis' eis'>4 |
  <fis b d' fis'>2. |
  <d gis b d'>2 <dis fis a cis' e'>4 |
  <e a cis' e'>2. |
  a'8 cis''8 gis'8 b'8 fis'8 a'8 |
  e'8 gis'8 d'8 fis'8 cis'8 e'8 |
  r8 d'8~ d'8 cis'8~ cis'8 b8 |
  \mark "Al segno hasta el signo de coda; después Trío"
  a4 r8 cis''8 cis''8[ b'8] |
  % --- Trio
  \key d \major
  \mark "TRIO"
  fis,8 a8 g,8 b8 fis,8 a8 |
  e,4 <e, b, d a>4 r4 |
  e,8 g8 fis,8 a8 e,8 g8 |
  d4 <fis, d fis>4 r4 |
  fis,8 a8 g,8 b8 fis,8 a8 |
  <e, b, d a>8 r8 e,8 g8 fis,8 a8 |
  <e, b, d a>8 r8 fis,8 a8 e,8 g8 |
  d4 <fis, d fis>4 r4 |
  fis'8 a'8 g'8 b'8 fis'8 a'8 |
  e'8. g'16 <cis' e' g'>2 |
  e'8 g'8 fis'8 a'8 e'8 g'8 |
  d'8. fis'16 <d' fis'>2 |
  fis'8 a'8 g'8 b'8 fis'8 a'8 |
  e'8 g'8 fis'8 a'8 g'8 b'8 |
  a'8 cis''8 b'8 d''8 cis''8 e''8 |
  d''4 <a' d''>8 r8 r4 |
  % --- Variacion para los ultimos ocho compases del Trio
  \mark "Variación para los últimos ocho compases del Trío"
  \tuplet 3/2 { fis'8 a'8 fis'8 } \tuplet 3/2 { g'8 b'8 g'8 } \tuplet 3/2 { fis'8 a'8 fis'8 } |
  e'8. g'16 <cis' e' g'>2 |
  \tuplet 3/2 { e'8 g'8 e'8 } \tuplet 3/2 { fis'8 a'8 fis'8 } \tuplet 3/2 { e'8 g'8 e'8 } |
  d'8. fis'16 <d' fis'>2 |
  \tuplet 3/2 { fis'8 a'8 fis'8 } \tuplet 3/2 { g'8 b'8 g'8 } \tuplet 3/2 { fis'8 a'8 fis'8 } |
  \tuplet 3/2 { e'8 g'8 e'8 } \tuplet 3/2 { fis'8 a'8 fis'8 } \tuplet 3/2 { g'8 b'8 g'8 } |
  \tuplet 3/2 { a'8 cis''8 a'8 } \tuplet 3/2 { b'8 d''8 b'8 } \tuplet 3/2 { cis''8 e''8 cis''8 } |
  d''4 <a' d''>8 r8 r4 |
  \bar "|."
}

lower = \fixed c {
  \key a \major
  \time 3/4
  \partial 4.
  r8 r4 |
  s2. |
  e,4 b4 d'4 |
  e,4 s2 |
  a,4 a4 cis'4 |
  a,4 s2 |
  e,4 gis4 b4 |
  e,4 s4 gis4 |
  <a cis'>4 a,8 r8 r4 |
  s2. |
  e,4 b4 d'4 |
  e,4 s2 |
  a,4 a4 cis'4 |
  a,2 s4 |
  s4 e,8 r8 r4 |
  e'4 d'4 b4 |
  a,4 <gis cis' e'>4 r4 |
  r4 e,4 r4 |
  r4 <b, d'>4 b4 |
  r4 e,4 r4 |
  r4 <a, cis'>4 a4 |
  <a, cis'>2. |
  e2. |
  b,2. |
  cis4 <a, cis'>4 a4 |
  r4 e,4 r4 |
  r4 <b, d'>4 b4 |
  r4 e,4 r4 |
  r4 <a, cis'>4 a4 |
  <fis a cis'>4 a,8 r8 r4 |
  e,8 r8 r4 s4 |
  e,4 fis,4 gis,4 |
  a,4 a,8 r8 r4 |
  % --- Trio
  \key d \major
  s2. |
  s2. |
  s2. |
  s2. |
  s2. |
  s2. |
  s2. |
  s2. |
  d2. |
  a,4 r4 e,4 |
  a,2. |
  d4 r4 fis,4 |
  d2. |
  e,2. |
  a,2. |
  d4 <a, d>8 r8 r4 |
  d2. |
  a,4 r4 e,4 |
  a,2. |
  d4 r4 fis,4 |
  d2. |
  e,2. |
  a,2. |
  d4 <a, d>8 r8 r4 |
}

\score {
  \context Staff <<
    \clef "treble_8"
    \context Voice = "upper" { \upper }
    \context Voice = "lower" { \lower }
  >>
}
