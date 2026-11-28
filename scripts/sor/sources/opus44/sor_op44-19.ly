\version "2.19.35"
% Sor, Op. 44 n.º 19. París, chez l’auteur et Pacini, IMSLP #837753 p. 10.
% Cotejo: París #470296 p. 20. Alturas sonantes.
upper = \fixed c {
  \tempo "Allegretto"

  \segno
  <d fis a>8 r8 <d fis a>8 <d fis a>4 <fis a d'>8 |
  <fis a d'>4 <a d' fis'>8 <a d' fis'>4 <fis' a'>8 |
  <fis' a'>4. \acciaccatura { g'16 } fis'8. e'16 fis'8 |
  <e' g'>4 <d' fis'>8 <a e'>4 r8 |
  <fis a>8 r8 <d fis a>8 <d fis a>4 <fis a d'>8 |
  <fis a d'>4 <a d' fis'>8 <a d' fis'>4 <fis' a'>8 |
  <fis' a'>4 <d' fis'>8 e'8. fis'16 e'8 |
  d'8 r8 d'8 <d fis d'>4 r8 ^"Fin." \bar ":|." |

  \bar ".|:" e'8 r8 e'8 e'4 a'8 |
  e'4 a'8 e'4 a'8 |
  \acciaccatura { a'16 } gis'8. fis'16 gis'8 e'8 fis'8 gis'8 |
  a'4. e'4. |
  e'4 e'8 e'4 a'8 |
  e'4 a'8 e'4 a'8 |
  \acciaccatura { a'16 } gis'8. fis'16 gis'8 e'8 fis'8 gis'8 |
  a'4. d''4. |

  \bar ".|:" <d fis a>8 r8 <d fis a>8 <d fis a>4 <fis a d'>8 |
  <fis a d'>4 <a d' fis'>8 <a d' fis'>4 <fis' a'>8 |
  <fis' a'>4. fis'8. e'16 fis'8 |
  <e' g'>4 <d' fis'>8 <a e'>4 r8 |
  <fis a>8 r8 <d fis a>8 <d fis a>4 <fis a d'>8 |
  <fis a d'>4 <a d' fis'>8 <a d' fis'>4 <fis' a'>8 |
  <fis' a'>4 <d' fis'>8 e'8 fis'8 e'8 |
  d'4 d'8 d'4 r8 ^"Fin." \bar "|." |

  \bar ".|:" <g b d'>4. <g b>8 <a c'>8 <ais cis'>8 |
  <b d'>4. g'4. |
  \acciaccatura { g'16 } fis'8. e'16 fis'8 g'4 gis'8 |
  a'4. d'4. |
  <g b d'>4.\accent <g b>8 <a c'>8 <ais cis'>8 |
  <b d'>4. g'4. |
  fis'4 fis'8 \acciaccatura { g'16 } fis'8 e'8 fis'8 |
  g'4 r8 s4 r8 ^"D.S. al Fin." \bar ":|." |
}
lower = \fixed c {
  s2. | s2. |
  s4. d'4. |
  s2. | s2. | s2. |
  s4. a4. |
  fis8 s8 <d fis>8 s4. |

  <a, cis'>8 r8 <a, cis'>8 <a, cis'>4 <a, cis'>8 |
  <a, cis'>4 <a, cis'>8 <a, cis'>4 <a, cis'>8 |
  <a, d'>4. <a, d'>4. |
  a,4 a,8 a,4 a,8 |
  <a, cis'>4 <a, cis'>8 <a, cis'>4 <a, cis'>8 |
  <a, cis'>4 <a, cis'>8 <a, cis'>4 <a, cis'>8 |
  <a, d'>2. |
  <a, cis'>4. s4. |

  s2. | s2. |
  s4. d'4. |
  s2. | s2. | s2. |
  s4. a4. |
  fis4 <d fis>8 <d fis>4 s8 |

  s2. |
  b4 g8 b4 d8 |
  <a c'>4 d8 <g b>4 d8 |
  <fis c'>4 d8 <fis c'>4 d8 |
  s2. |
  s4 d8 b4 d8 |
  <a c'>4 r8 <d a c'>4. |
  <g b>4 d8 g,4 s8 |
}
inner = \fixed c {
  \repeat unfold 11 { s2. | }
  cis'2. |
  \repeat unfold 20 { s2. | }
}
\score { \context Staff <<
  \time 6/8 \clef "treble_8" \key d \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "inner" { \inner }
>> }
