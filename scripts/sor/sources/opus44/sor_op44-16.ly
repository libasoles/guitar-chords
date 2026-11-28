\version "2.19.35"
% Sor, Op. 44 n.º 16. París, chez l’auteur et Pacini, IMSLP #837753 p. 9.
% Cotejo: París #470296 p. 17. Alturas sonantes.
upper = \fixed c {
  \tempo "Andante"

  \partial 8 a8 |
  fis'8 d'8 a8 ais8 |
  b8 e'4 d'8 |
  <a cis'>8 a'16. cis'32 d'8 <d' fis'>8 |
  <d' fis'>4 <cis' e'>8 a8 |
  fis'8 d'8 b8 gis8 |
  a16 b16 cis'16 d'16 dis'16 e'16 \acciaccatura { g'16 } fis'16 e'16 |
  e'16 dis'16 d'16 b16 a16 gis16 d'16 b16 |
  \partial 4. a4 r8 \bar ":|." |

  \partial 8 \bar ".|:" a8 |
  cis'4. e'8 |
  d'4. fis'8 |
  e'8 g'8 fis'8 d'8 |
  d'16. cis'32 e'16. cis'32 a8 a'8 |
  cis'4. e'8 |
  d'4. d'8 |
  gis'4. gis'8 |
  a'4 cis'8 a8 |
  fis'8 d'8 a8 ais8 |

  b8 g'16. fis'32 e'8 d'8 |
  cis'8 a'16. cis'32 d'8 <d' fis'>8 |
  <d' fis'>4 <cis' e'>8 <c' fis'>8 |
  g'8 g'16. fis'32 dis'4 |
  fis'8 fis'16. e'32 dis'4 |

  r8 e'16 d'16 d'16( cis'16) b16 cis'16 |
  d'8 e'8 fis'8 g'8 |
  a'4. a'8 |
  a'16( g'16) fis'16 e'16 dis'16( e'16) b16 e'16 |
  e'8 d'4 cis'8 |
  d'4. r8 \bar "|." |
}
lower = \fixed c {
  s8 |
  d4 fis4 |
  g4 gis4 |
  a8 g8 fis8 d8 |
  a8 a,8 r4 |
  d4. d8 |
  cis2 |
  d4 e4 |
  r8 e8 a,8 |

  r8 |
  r8 a,8 g4 |
  r8 a,8 fis8 d8 |
  cis8 a,8 d8 fis8 |
  a4 r4 |
  r8 a,8 g4 |
  r8 a,8 fis4 |
  r8 a,8~ <a, f d'>4 |
  r8 e8 a,4 |
  d4 fis4 |

  g8 e16. fis32 g8 gis8 |
  a8 g8 fis8 d8 |
  a8 a,8 r8 d8 |
  <g b>4. <g b>8 |
  <fis ais>4 r8 <fis a>8 |

  <e gis>4 <a, g>4 |
  <d fis>8 cis8 d8 e8 |
  s8 a8 d'8 cis'8 |
  <g b>4 r4 |
  r8 <fis a>8 <e g>4 |
  <d fis>8 a,8 d8 s8 |
}
inner = \fixed c {
  s8 |
  \repeat unfold 7 { s2 | }
  s4. |
  s8 |
  \repeat unfold 16 { s2 | }
  fis2 |
  s2 |
  a,2 |
  s2 |
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key d \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "inner" { \inner }
>> }
