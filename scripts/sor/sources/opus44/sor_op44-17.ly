\version "2.19.35"
% Sor, Op. 44 n.º 17. París, chez l’auteur et Pacini, IMSLP #837753 p. 9.
% Cotejo: París #470296 p. 18. Alturas sonantes.
upper = \fixed c {
  \tempo "Cantabile"

  a4 f'4 e'4 |
  e'4 d'4 a4 |
  bes4 e'4. d'8 |
  < a d'>4 cis'8 e'8 a4 |
  s4 f'4. e'8 |
  <g e'>4 <f d'>4 <e des'>4 |
  <f c'>4 <f d'>4 <bes e'>4 |
  <a f'>4 r4 r4 |

  a4 f'4 e'4 |
  e'4 d'4 a4 |
  bes4 e'4. d'8 |
  < a d'>4 cis'8 e'8 a4 |
  a4 f'4. e'8 |
  <g e'>4 <f d'>4 <e des'>4 |
  <f c'>4 <f d'>4 <bes e'>4 |
  <a f'>4 r4 r4 |

  c'4 f'4 a'4 |
  a'8. gis'16 g'4 r4 |
  \acciaccatura { g'16 } f'4 e'4 d'4 |
  d'4 cis'8. e'16 a4 |
  <cis' a'>4 <d' gis'>4 <e' g'>4 |
  <d' f'>4 cis'4 d'4 |
  f'4( e'4) <g cis'>4 |
  d'8 r8 a8. f16 s4 |

  c'4 f'4 a'4 |
  a'8. gis'16 g'4 r4 |
  \acciaccatura { g'16 } f'4 e'4 d'4 |
  d'4 cis'8. e'16 a4 |
  <cis' a'>4 <d' gis'>4 <e' g'>4 |
  <d' f'>4 cis'4 d'4 |
  f'4( e'4) <g cis'>4 |
  d'8 r8 a8. f16 s4 |
}
lower = \fixed c {
  r4 d4 e4 |
  f2. |
  g2 gis4 |
  s4 a,2 |
  r4 d4 a,4 |
  bes,2. |
  a,4 bes,4 c4 |
  r8 f8 c8 a,8 f,4 |

  r4 d4 e4 |
  f2. |
  g2 gis4 |
  s4 a,2 |
  r4 d4 a,4 |
  bes,2. |
  a,4 bes,4 c4 |
  r8 f8 c8 a,8 f,4 |

  <f a>2 <f c'>4 |
  <c bes>2 <cis bes>4 |
  <a d>4 <g, g>4 <gis, f>4 |
  <a, e>2 r4 |
  a,8 r8 b,8 r8 cis8 r8 |
  d4 <e g>4 <f a>4 |
  <g bes>2 a,4 |
  <d f>8 s8 s4 d4 |

  <f a>2 <f c'>4 |
  <c bes>2 <cis bes>4 |
  <a d>4 <g, g>4 <gis, f>4 |
  <a, e>2 r4 |
  a,8 r8 b,8 r8 cis8 r8 |
  d4 <e g>4 <f a>4 |
  <g bes>2 a,4 |
  <d f>8 s8 s4 d4 \bar "|." |
}
inner = \fixed c {
  s2. | s2. | s2. | s2. |
  a4~ a4 g4 |
  s2. | s2. | s2. |

  s2. | s2. | s2. | s2. |
  s4 a4 g4 |
  s2. | s2. | s2. |

  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
  s2. | s2. | s2. | s2. | s2. | s2. | s2. | s2. |
}
\score { \context Staff <<
  \time 3/4 \clef "treble_8" \key d \minor
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "inner" { \inner }
>> }
