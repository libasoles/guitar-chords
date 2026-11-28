\version "2.19.35"
% Sor, Op. 44 n.º 23. París, chez l’auteur et Pacini, IMSLP #837753 p. 12.
% Cotejo: París #470296 p. 24. Alturas sonantes.
upper = \fixed c {
  \tempo "Allegro moderato"
  \segno
  \acciaccatura { b,16 } a,8 gis,8 a,8 e,4 c8 |
  a,4 e8 c4 a8 |
  e4 a8 \acciaccatura { a16 } c'8. b16 a8 |
  gis4 b8 e8 r4 |
  e'4 e'8 g'8( f'8) e'8 |
  <a e'>4. <b d'>4. |
  c'8. b16 c'8 <b d'>4 <gis b>8 |
  a4 c'8~ c'4 r8 \bar ":|." |

  \bar ".|:" <e c'>4 <g e'>8 <e c'>4 <g e'>8 |
  <e c'>4 <g e'>8 <e c'>4 <g e'>8 |
  <f d'>4 <g cis'>8 <f d'>4 <g b>8 |
  <e c'>4 <g e'>8 g'4 g8 |
  <e c'>4 <g e'>8 <e c'>4 <g e'>8 |
  <e c'>4 <g e'>8 <e c'>4 <g e'>8 |
  d'4 b8 g8 a8 b8 |
  <e c'>4 <g e'>8 <e c'>4 r8 |

  a,8 gis,8 a,8 e,4 c8 |
  a,4 e8 c4 a8 |
  e4 a8 c'8. b16 a8 |
  gis4 b8 e4 r8 |
  e'4 e'8 g'8( f'8 e'8) |
  <a e'>4. <b d'>4. |
  \acciaccatura { d'16 } c'8. b16 c'8 <b d'>4 <gis b>8 |
  a4 <e c'>8 s4 r8 ^"Fin." \bar ":|." |

  \key a \major
  \bar ".|:" <cis' e'>4. <d' fis'>4 <cis' e'>8 |
  <bis dis'>4 <cis' e'>8 <d' fis'>4 <e' gis'>8 |
  <fis' a'>4 <eis' gis'>8 \acciaccatura { b'16 } <fis' a'>4 <e' gis'>8 |
  <e' gis'>4 <d' fis'>8 <cis' e'>4 r8 |
  d'8 b8 e'8 d'8 b8 e'8 |
  cis'8 e'8 a'8 cis''8( b'8) a'8 |
  gis'8( e'8) b'8 gis'8( e'8) b'8 |
  a'4 a8 r8 r4 ^"D.S. al Fin." \bar "|." |
}
lower = \fixed c {
  s2. | s2. | s2. | s2. |
  <d gis b>2. |
  c4. d4. |
  <a e>4. e,4. |
  a,4 e8~ <a, e>8 s4 |

  c4. c4. |
  c4. c4. |
  c4. c4. |
  c4. <c e>4. |
  c4. c4. |
  c4. c4. |
  <c f>2. |
  c4 c8 c4 s8 |

  s2. | s2. | s2. | s2. |
  <d gis b>2. |
  c4. d4. |
  <a e>4. e,4. |
  a,4 s8 a,4 s8 |

  a,2.~ |
  a,2.~ |
  a,2.~ |
  a,2. |
  gis4. e,4. |
  a,2. |
  <e, d'>2. |
  <a, cis'>4 s8 a,4 s8 |
}
\score { \context Staff <<
  \time 6/8 \clef "treble_8" \key a \minor
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
>> }
